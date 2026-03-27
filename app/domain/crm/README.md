# Domínio CRM

## Visão geral

O módulo CRM gerencia a base de clientes (contatos), seus eventos, tags de segmentação, imagens de perfil, campanhas e envios. A chave de identidade de cada cliente é o telefone no formato E.164.

---

## Modelos de dados (Prisma)

### `CrmCustomer` — cliente/contato
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | PK |
| `phone_e164` | String único | Telefone BR em E.164 (`+5544999999999`) |
| `name` | String? | Nome do cliente |
| `email` | String? | Email |
| `preferred_channel` | `whatsapp` \| `phone` \| `unknown` | Canal preferencial |
| `gender` | `female` \| `male` \| `unknown` | Gênero |
| `profession` | String? | Profissão |
| `age_profile` | `young` \| `adult` \| `senior` \| `unknown` | Faixa etária |
| `preferred_payment_method` | `pix` \| `card` \| `cash` \| `unknown` | Pagamento preferido |
| `neighborhood`, `city`, `postal_code` | String? | Endereço (campos simples) |
| `delivery_address_last` | JSON? | Último endereço de entrega completo |
| `lgpd_consent` + `consent_at` | Bool + DateTime? | Consentimento LGPD |
| `first_order_at`, `last_order_at` | DateTime? | Datas de pedidos |
| `orders_count`, `total_revenue`, `avg_ticket` | Int/Decimal | Métricas de compra |

### `CrmCustomerTag` + `CrmCustomerTagLink`
Tags livres (key/label). Cada cliente pode ter N tags via tabela de ligação com constraint unique `(customer_id, tag_id)`.

### `CrmCustomerEvent`
Log de eventos do cliente. Campos principais: `event_type`, `source`, `external_id`, `payload` (JSON), `payload_raw` (texto). Tipos usados no sistema:
- `PROFILE_CREATE` / `PROFILE_UPDATE`
- `WHATSAPP_SENT` / `WHATSAPP_RECEIVED`
- `NOTE` (manual via admin)

### `CrmCustomerImage`
Fotos de perfil recebidas do WhatsApp. Ligadas ao cliente pelo `customer_id`.

### `CrmCampaign` + `CrmCampaignSend`
Campanhas de marketing. Cada `CrmCampaignSend` registra um envio para um cliente específico com `status` e payload.

---

## Arquivos do domínio

### `normalize-phone.server.ts`
**`normalize_phone_e164_br(input)`** — converte qualquer formato de telefone BR para E.164. Aceita `44999999999`, `+55 44 99999-9999`, `044999999999`, etc. Retorna `null` se inválido (DDD 2 dígitos + 8/9 dígitos locais). É a função de entrada para criação/busca de clientes.

### `customer-segmentation.ts`
**`CRM_SEGMENTATION_TAGS`** — array com 7 segmentos de cliente pré-definidos: `Praticidade`, `Família`, `Experiência Gastronômica`, `Social/Encontro`, `Promoção`, `Rotina`, `Curioso/Novidade`. Cada item define `key`, `label`, `characteristic`, `values` e `strategy`. Usado na aba de Tags do cliente para sugestão de segmentação.

### `crm-whatsapp-events.server.ts`
**`logCrmWhatsappSentEventByPhone(input)`** — registra um evento `WHATSAPP_SENT` no CRM a partir do número de telefone. Normaliza o telefone, busca o cliente, e cria o `CrmCustomerEvent`. Retorna `{ ok: false, reason }` se telefone inválido ou cliente não encontrado. Usado pelo sistema de envio de WhatsApp para rastrear mensagens enviadas.

---

## Rotas (`/admin/crm/...`)

### Layout raiz — `admin.crm.tsx`
Container com título "CRM" e `<Outlet>`. Exibe loading spinner durante navegação.

### Lista de clientes — `admin.crm._index.tsx`
- **GET** — paginação (page/pageSize/q), busca por nome ou telefone, 4 cards de estatística (total, ontem, 7 dias, 30 dias), tabela de clientes com foto, tags e link para perfil.
- **POST** — "cadastro rápido": upsert por telefone, redireciona para timeline do cliente.

### Novo cliente (formulário completo) — `admin.crm.new.tsx`
- **POST** — cria cliente com todos os campos (telefone, nome, email, gênero, faixa etária, pagamento, endereço, LGPD). Rejeita se telefone já existir (diferente do cadastro rápido que faz upsert).

### Layout do cliente — `admin.crm.$customerId.tsx`
Cabeçalho com nome, telefone e tags do cliente. Abas: **Dados | Conversa | Timeline | Tags | Envios**. Passa o cliente via `<Outlet context>`.

### Dados do cliente — `admin.crm.$customerId.profile.tsx`
- Exibe galeria de imagens de perfil (com botão de deletar), métricas de compra (pedidos, ticket médio, receita), formulário completo de edição.
- **POST intent=`update_profile`** — atualiza todos os campos editáveis.
- **POST intent=`delete_image`** — remove imagem de perfil + registra evento.

### Conversa WhatsApp — `admin.crm.$customerId.conversation.tsx`
- Filtra eventos `WHATSAPP_RECEIVED` / `WHATSAPP_SENT` por range de data. Sem filtro: últimas 60 mensagens. Com filtro: até 200 em ordem cronológica.
- Gera automaticamente um **prompt para ChatGPT** com contexto do cliente + transcrição completa.
- UI visual estilo chat (bolhas verde = atendente, branco = cliente).

### Timeline — `admin.crm.$customerId.timeline.tsx`
- Lista os 50 eventos mais recentes do cliente.
- **POST** — permite registrar evento manual (tipo livre + payload texto).

### Tags — `admin.crm.$customerId.tags.tsx`
- Lista tags do cliente. Permite adicionar (key/label livre ou de `CRM_SEGMENTATION_TAGS`) e remover.
- Exibe os 7 segmentos pré-definidos com botão de adição rápida.
- **POST intent=`add_tag`** — upsert da tag + upsert do link.
- **POST intent=`remove_tag`** — deleta o link.

### Envios — `admin.crm.$customerId.sends.tsx`
Lista os últimos 20 `CrmCampaignSend` do cliente (campanha, status, data). Somente leitura.

### Campanhas — `admin.crm.campaigns.tsx`
Lista as 50 campanhas mais recentes com nome, descrição e contagem de envios. Somente leitura.

### Jornada de inserimentos — `admin.crm.jornada-de-inserimento.tsx`
Relatório mensal de cadastros por dia. Mostra se a meta diária foi atingida (verde/vermelho). Segunda e terça são marcados como dias fechados. A meta diária é configurável e salva em `Setting` com `context=crm_jornada_de_inserimento`.

---

## Fluxo de entrada de clientes

```
Telefone (qualquer formato BR)
  → normalize_phone_e164_br()
  → prisma.crmCustomer.upsert/create
  → prisma.crmCustomerEvent.create (PROFILE_CREATE / PROFILE_UPDATE)
```

## Integração com WhatsApp

Quando uma mensagem WhatsApp é enviada para um cliente, chama-se `logCrmWhatsappSentEventByPhone()` que:
1. Normaliza o telefone
2. Busca o `CrmCustomer` pelo `phone_e164`
3. Cria `CrmCustomerEvent` com `event_type=WHATSAPP_SENT`

Mensagens recebidas (`WHATSAPP_RECEIVED`) são registradas por outra parte do sistema e aparecem na aba Conversa.
