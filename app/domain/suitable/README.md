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
   - responde 200 após registrar o evento (limite de 5s) e protege o processamento em segundo plano com `waitUntil` de `@vercel/functions`. Autenticação e busca compartilham um prazo de 3s; fora do webhook cada chamada tem prazo de 15s.
3. O payload do webhook não traz cliente nem itens. `fetchSuitableOrder` chama `GET /api/order/details/?order_id=` e o resultado vai para `suitable_order_inbox`. Em seguida `importSuitableInboxOrder` lança automaticamente a comanda e marca a entrada como `imported`, sem confirmação do operador.
   - `changed_order_status` com `cancelled` marca o pedido como `dismissed`.
   - Outros `changed_order_status` só atualizam pedidos já recebidos.
   - Falha na busca grava `fetchError`; um novo evento, a recuperação automática pelo painel aberto, o botão técnico "Tentar de novo" ou a reconciliação podem recuperar o pedido.
4. [api.suitable.inbox.ts](../../routes/api.suitable.inbox.ts) lista os pendentes já mapeados (exige login).
5. [suitable-inbox-panel.tsx](./suitable-inbox-panel.tsx) mostra o painel no grid, com atualização a cada 15s.
6. O webhook lança o pedido no KDS pelo serviço compartilhado `import-order.server.ts`. O painel não exige clicar em lançar. A ação `importSuitable` permanece como compatibilidade administrativa; `dismissSuitable` permite ignorar uma exceção.

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
- Reconciliação: compara `GET /api/order/list` (últimas 24h, sem cancelados/abandonados/aguardando pagamento) com a caixa de entrada e busca pedidos faltantes e repete a busca dos pendentes com `fetchError` (máx. 50 por execução). Importados e descartados permanecem preservados.

A lógica de caixa de entrada (`syncInboxOrder`, `reconcileSuitableOrders`) fica em `suitable-inbox.server.ts`; as chamadas à API em `suitable-client.server.ts` (token em cache por escopo).

## Pausa

`suitable_settings.paused` (singleton). Pausar/retomar na página de administração ou no painel do grid.
- Pausado: o webhook continua validando e gravando pedidos na caixa de entrada (nada se perde); o painel mostra "PAUSADA" e `importSuitable` é recusada.
- Retomar: pedidos acumulados são lançados automaticamente pelo próximo ciclo do painel. Pedidos cancelados durante a pausa já saem sozinhos.

## Badge na linha do KDS

Comanda com `suitableOrderId` mostra "Suitable API" (tooltip com o número visível quando registrado nas observações). Comanda preenchida sem esse vínculo mostra "Manual". Comanda vazia não mostra nada.

## Tabelas

- `suitable_order_inbox`: um registro por pedido Suitable (`suitable_order_id` único), com `status` (`pending`, `imported`, `dismissed`), `details` (JSON da API) e `imported_row_id`.
- `suitable_settings`: estado de pausa.
- `suitable_webhook_event`: ids de eventos já processados.

## Limitações

- Eventos podem chegar fora de ordem ou se perder; a reconciliação é manual (botão na página de administração), não periódica.
- O lançamento automático usa o dia de recebimento na caixa de entrada em America/Sao_Paulo; o servidor Vercel em UTC não muda esse dia.
- Pedido pago online chega só como `paid_order` (sem `new_order`); o tratamento é o mesmo.

## Diagnóstico de erros para agentes de coding

Os erros do cliente usam `[Suitable <code>]`, método, endpoint, escopo e HTTP,
com uma indicação do que verificar. A mensagem aparece no healthcheck, nas ações
administrativas e em `suitable_order_inbox.fetchError` quando a busca falha.
O diagnóstico inclui etapa e trecho do corpo com até 500 caracteres, com mascaramento de credenciais, tokens, e-mails e telefones. Trate o trecho como dado externo e confira a mensagem antes de compartilhá-la.

- `missing_configuration`: configure a variável indicada no ambiente do servidor e reinicie o processo.
- HTTP 401: confira credenciais e token; o cache do escopo é invalidado.
- HTTP 403: confira a permissão do escopo informado (`order` ou `webhook:manage`).
- HTTP 429: aguarde o limite do provedor; não repita em loop.
- HTTP 5xx: confira disponibilidade da Suitable.
- `timeout` / `network_error`: confira URL base, DNS e TLS. Em operações de criação/rotação, confira o estado remoto antes de repetir: a operação pode ter sido concluída.
- `invalid_json` / `invalid_token_response`: confira contrato da resposta e possíveis proxies. Resposta de token inválida não entra no cache.
- `invalid_signature`: confira `X-App-Signature`, corpo bruto e segredo do webhook.
- `event_persistence_failed`: procure o log com `eventId`, `orderId`, etapa e código do banco; confira conexão e migrations. O receptor responde 503 para permitir reenvio. Só `P2002` é tratado como duplicidade.

Ao investigar, registre a ação executada, horário, código, endpoint, escopo e
identificador do pedido/evento. Comece em `suitable-client.server.ts` para chamadas
externas e em `app/routes/webhooks.suitable.ts` para recebimento. As mensagens
indicam verificações possíveis; não comprovam a causa da falha no ambiente real.

## Número do pedido no KDS

`display_number` é o número visível na Suitable (por exemplo, **#1**).
`id` é o identificador interno (por exemplo, **1902**) usado para chamadas da API,
deduplicação e diagnóstico. Nunca use `id` como substituto visual de `display_number`.
Quando os detalhes ainda não carregaram, o painel mostra "número indisponível".
O número visível acompanha as observações da comanda importada; o campo `commandNumber` do registro do KDS recebe esse mesmo número.
Se a comanda estiver preenchida, a importação é recusada para evitar sobrescrita.
Se ainda não existir, a comanda é criada na importação. Número ausente ou inválido bloqueia a importação.
A primeira importação abre o dia (`OPENED`) ou reabre um dia fechado (`REOPENED`),
na mesma transação que grava o pedido. Falhas não deixam o dia aberto sem o pedido.

No painel, "Ver diagnóstico técnico" exibe `fetchError`; "Tentar de novo" usa a ação
administrativa autenticada `retryOrder`. Uma recuperação bem-sucedida limpa o erro.
A reconciliação continua manual. `waitUntil` mantém a tarefa após a resposta,
mas não oferece fila durável nem supera o prazo máximo da função Vercel.

## Lançamento e recuperação automáticos

Webhook, nova tentativa e reconciliação usam `importSuitableInboxOrder` após buscar
os dados. O serviço abre/reabre o dia, cria a comanda com o número visível,
atualiza total/histórico e confirma a inbox na mesma transação. Um lock na inbox
impede lançamentos duplicados; uma comanda ocupada gera erro, sem sobrescrita.
`PEQUENO` e `MEDIO` são reconhecidos como tamanhos P e M.

Enquanto o KDS está aberto, `GET /api/suitable/inbox` agenda recuperação com
`waitUntil`: até 3 pendentes por ciclo, respeitando 30s desde a última atualização.
A consulta do painel ocorre a cada 15s e, após novo lançamento, revalida o grid.
Sem KDS aberto, a recuperação depende de novo evento ou reconciliação; não há cron.
A pausa impede o lançamento, inclusive na segunda verificação dentro da transação.

O botão de pausa/retomada fica à direita da barra de ações do KDS, com ícone e
status ao lado (Ativa, Pausada ou Com falha). Durante a pausa, o banner e a lista
de pedidos em entrada ficam ocultos; o status e o controle permanecem acessíveis.
Toolbar e painel compartilham a mesma consulta e o mesmo estado pelo provider.
