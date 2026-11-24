# Integração Suitable → KDS

Recebe pedidos do cardápio Suitable e preenche comandas do KDS (`admin/kds/atendimento/$date/grid`).

Docs Suitable:
- Webhooks: https://docs.suitable.com.br/pt-br/guias/webhooks/
- Token: https://docs.suitable.com.br/pt-br/docs/post-api-auth-token-f7bda218347046a104624867/
- Detalhes do pedido: https://docs.suitable.com.br/pt-br/docs/get-api-order-details-1c4fc8859de7b88792c8903b/

## Fluxo

1. Suitable envia `POST /webhooks/suitable` (eventos `new_order`, `paid_order`, `changed_order_status`).
2. [webhooks.suitable.ts](../../routes/webhooks.suitable.ts):
   - valida `X-App-Signature` (HMAC-SHA256 do corpo bruto, chave `SUITABLE_WEBHOOK_SECRET`);
   - descarta eventos com mais de 24h;
   - deduplica pelo `id` do evento (`suitable_webhook_event`);
   - responde 200 de imediato (limite de 5s) e processa em segundo plano.
3. O payload do webhook não traz cliente nem itens. `fetchSuitableOrder` chama `GET /api/order/details/?order_id=` e o resultado vai para `suitable_order_inbox` (status `pending`).
   - `changed_order_status` com `cancelled` marca o pedido como `dismissed`.
   - Outros `changed_order_status` só atualizam pedidos já recebidos.
   - Falha na busca grava `fetchError`; um novo evento tenta de novo.
4. [api.suitable.inbox.ts](../../routes/api.suitable.inbox.ts) lista os pendentes já mapeados (exige login).
5. [suitable-inbox-panel.tsx](./suitable-inbox-panel.tsx) mostra o painel no grid, com atualização a cada 15s.
6. Ações no grid:
   - `importSuitable`: preenche a primeira comanda vazia do dia (`emptyReservation`) e marca a entrada como `imported`.
   - `dismissSuitable`: marca como `dismissed`.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `suitable-client.server.ts` | Token (`client_credentials`, em cache até perto de expirar) e busca do pedido. |
| `map-order.ts` | Converte `SuitableOrderDetails` em campos do KDS (`KdsFormFill`). |
| `map-order.test.ts` | Teste do mapeamento. |
| `suitable-inbox-panel.tsx` | Painel de pedidos pendentes. |

## Mapeamento

| Suitable | KDS |
| --- | --- |
| `customer.name` / `customer.phone` | `customerName` / `customerPhone` (telefone só dígitos) |
| `total` | `orderAmount` |
| `order_type = delivery` | `hasMoto = true`, `motoValue = delivery_fee` |
| `order_type = takeout` | `takeAway = true` |
| `payment.methods[].type` | `Cartão` → crédito; `Dinheiro` → dinheiro; demais → outro |
| `items` (nome, categoria, opções) | tamanhos `F/M/P/I/FT` por palavra-chave |
| canal | sempre `Suitable` |

Tamanho (`detectSize`): grande/gigante/família → `F`, média → `M`, pequena/broto → `P`, individual → `I`.
Ajuste a heurística aos nomes reais do cardápio.

Pedido com tamanho não detectado fica `pendente` (conferência manual). Com tamanhos detectados vira `novoPedido`.

Também gravados na comanda (migration `20261124010000_kds_order_suitable_fields`):

| Suitable | KDS (`kds_daily_order_details`) |
| --- | --- |
| `id` | `suitableOrderId` |
| `delivery_address.formatted` | `deliveryAddress` |
| `payment.change_for` | `changeFor` |
| `comments` (pedido e itens) | `notes` |
| `paid` | `paidOnline` |
| `items` + opções | `orderItems` (nome, qtd, tamanho, sabores, observações) |

`orderItems` só é gravado se passar em `parseOrderItems` (pizza exige tamanho). Se não passar, os itens vão como linhas em `notes`.

Não preenchido: zona de entrega, desconto/taxas, agendamento, `source`, fidelidade, equipe, tipo exato de pagamento (Pix/débito caem em "outro"/crédito).

## Configuração

Variáveis (`.env.example`):

```
SUITABLE_API_URL=https://api.suit.com.br
SUITABLE_CLIENT_ID=
SUITABLE_CLIENT_SECRET=
SUITABLE_WEBHOOK_SECRET=
```

- A chave de API precisa do escopo `order` (o token é pedido com esse escopo).
- Cadastro do webhook: `POST https://api.suit.com.br/api/webhooks/` com token de escopo `webhook:manage` e corpo
  `{ "name": "...", "url": "https://SEU_DOMINIO/webhooks/suitable", "events": ["new_order","paid_order","changed_order_status"] }`.
  O `secret` volta só na criação (ou em `POST /api/webhooks/{id}/rotate-secret/`) e vira `SUITABLE_WEBHOOK_SECRET`.
- A URL precisa ser `https` e pública.
- Migration: `prisma/migrations/20261124000000_suitable_inbox`.

## Página de administração

`/admin/suitable-api` ([admin.suitable-api.tsx](../../routes/admin.suitable-api.tsx)), com entrada no menu admin:

- Healthcheck: variáveis presentes/ausentes, `GET /health` e emissão de token, com latência.
- Webhooks: lista, cadastra, pausa/ativa, envia evento de teste e troca o segredo (`webhook:manage`). O segredo aparece uma única vez; salve em `SUITABLE_WEBHOOK_SECRET`.
- Atividade: último evento, caixa de entrada por status, falhas de busca com "Tentar de novo".
- Reconciliação: compara `GET /api/order/list` (últimas 24h, sem cancelados/abandonados/aguardando pagamento) com a caixa de entrada e busca os pedidos faltantes (máx. 50 por execução).

A lógica de caixa de entrada (`syncInboxOrder`, `reconcileSuitableOrders`) fica em `suitable-inbox.server.ts`; as chamadas à API em `suitable-client.server.ts` (token em cache por escopo).

## Tabelas

- `suitable_order_inbox`: um registro por pedido Suitable (`suitable_order_id` único), com `status` (`pending`, `imported`, `dismissed`), `details` (JSON da API) e `imported_row_id`.
- `suitable_webhook_event`: ids de eventos já processados.

## Limitações

- Eventos podem chegar fora de ordem ou se perder; a reconciliação é manual (botão na página de administração), não periódica.
- Data do pedido não é considerada: o pedido entra na comanda do dia aberto no grid.
- Pedido pago online chega só como `paid_order` (sem `new_order`); o tratamento é o mesmo.
