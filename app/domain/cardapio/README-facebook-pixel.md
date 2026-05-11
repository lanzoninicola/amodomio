# Domínio Cardápio: Facebook Pixel

Este documento descreve a implementação atual do pixel do Facebook para o cardápio público.

## Resumo executivo

- A integração do pixel é específica do `/cardapio`.
- O admin gerencia múltiplas configurações em `/admin/marketing/facebook-pixel`.
- O modelo é híbrido:
  - configuração principal por rota;
  - eventos dinâmicos em tabela filha.
- O sistema suporta dois modos:
  - `direct`: injeta Meta Pixel e dispara via `fbq`;
  - `gtm`: injeta GTM e envia eventos para o `dataLayer`.
- Novos eventos não exigem novas colunas no schema.

## Arquivos principais

- configuração e persistência:
  - `prisma/schema.prisma`
  - `app/domain/cardapio/facebook-pixel.server.ts`
- runtime client:
  - `app/domain/cardapio/facebook-pixel.client.ts`
  - `app/domain/cardapio/components/cardapio-facebook-pixel.tsx`
- integração com o layout público:
  - `app/routes/cardapio.tsx`
- tela administrativa:
  - `app/routes/admin.marketing.facebook-pixel.tsx`
  - `app/routes/admin.marketing.facebook-pixel.config.$configId.tsx`
  - `app/routes/admin.marketing.facebook-pixel.event.$eventId.tsx`

## Modelo de dados

### `CardapioFacebookPixelConfig`

Responsável por guardar o estado principal da integração.

Campos centrais:

- `name`
- `routePath`
- `enabled`
- `mode`
- `pixelId`
- `gtmContainerId`

Regra atual:

- cada configuração pertence a uma rota;
- `routePath` é único;
- a resolução em runtime usa a configuração com rota mais específica que casar com o pathname atual.

### `CardapioFacebookPixelEvent`

Responsável por guardar os eventos configuráveis da integração.

Campos centrais:

- `configId`
- `eventKey`
- `eventName`
- `trigger`
- `enabled`
- `payloadJson`

Regra atual:

- `eventKey` é único dentro da configuração;
- `trigger` é o gatilho interno emitido pelo frontend do cardápio;
- `eventName` é o nome enviado ao Meta Pixel ou ao `dataLayer`.

## Eventos seed atuais

Na criação inicial de cada configuração, o sistema semeia:

- `page_view`
  - `eventName = "PageView"`
  - `trigger = "page_view"`
- `fazer_pedido_click`
  - `eventName = "InitiateCheckout"`
  - `trigger = "fazer_pedido_click"`

Observação importante:

- os seeds só entram na criação inicial da configuração;
- se um evento for removido no admin, ele não é recriado automaticamente.

## Fluxo de execução

### 1. Loader do cardápio

`app/routes/cardapio.tsx` chama `getFacebookPixelRuntimeConfigForPath(url.pathname)`.

Esse loader:

- garante a configuração default de `/cardapio` quando necessário;
- resolve a configuração correta pela rota atual;
- carrega os eventos filhos;
- converte `payloadJson` em objeto quando o JSON é válido.

### 2. Injeção no `/cardapio`

`CardapioFacebookPixel` é renderizado no layout do cardápio.

Consequência:

- a integração não é global do site;
- o pixel não é injetado em `/admin` nem em outras rotas públicas.

### 3. Disparo de eventos

O runtime ouve um evento customizado de browser:

- `cardapio-facebook-pixel-track`

O helper client `trackCardapioFacebookPixelTrigger(trigger, payload?)` publica esse evento no `window`.

### 4. Resolução por modo

#### Modo `direct`

- injeta `https://connect.facebook.net/en_US/fbevents.js`
- faz `fbq("init", pixelId)`
- para cada evento:
  - usa `fbq("track", ...)` para eventos padrão reconhecidos;
  - usa `fbq("trackCustom", ...)` para o restante.

#### Modo `gtm`

- injeta `https://www.googletagmanager.com/gtm.js?id=...`
- publica no `dataLayer`:
  - `event`
  - `metaEventKey`
  - `metaEventName`
  - `metaPayload`
  - `locationPath`
  - `locationSearch`

## Trigger atual implementado no cardápio default

Hoje o botão `Fazer pedido` dispara:

- `trigger = "fazer_pedido_click"`

O ponto de emissão está no layout público do cardápio, usando o helper client em `app/routes/cardapio.tsx`.

O componente `FazerPedidoButton` foi ajustado para aceitar `onClick`, mas a lógica de tracking deve continuar sendo decidida pelo chamador, não pelo botão em si.

## Como adicionar um novo evento

Se o cardápio passar a precisar de um novo evento:

1. abrir a configuração da rota desejada no admin;
2. criar ou editar a linha do evento;
3. escolher:
   - `eventKey` interno;
   - `eventName` enviado ao Meta;
   - `trigger` ouvido pelo frontend;
   - `payloadJson` padrão, se necessário;
4. emitir `trackCardapioFacebookPixelTrigger("novo_trigger", payloadOpcional)` no ponto certo da rota atendida.

Importante:

- se o novo caso exigir apenas uma nova rota/configuração ou um novo trigger, não precisa alterar schema;
- só precisa alterar schema se a própria configuração principal mudar de forma estrutural.

## Regras de validação

### Configuração principal

- `enabled + mode=direct` exige `pixelId`;
- `enabled + mode=gtm` exige `gtmContainerId`;
- `gtmContainerId` deve seguir o formato `GTM-XXXX`.

### Evento

- `eventKey` é obrigatório;
- `eventKey` deve usar apenas letras, números e underscore;
- `eventName` é obrigatório;
- `trigger` é obrigatório;
- `payloadJson`, quando preenchido, deve ser um objeto JSON válido.

## Limites e decisões atuais

- não existe camada de LGPD/consentimento aqui;
- não existe Conversion API nessa implementação;
- a integração atual cobre Pixel direto e GTM apenas no frontend;
- `page_view` é derivado da navegação do cardápio;
- o admin permite remover eventos default, e isso é intencional.

## Perguntas diagnósticas úteis

Quando algo “não está rastreando”, verificar nesta ordem:

1. a rota aberta é realmente `/cardapio`?
2. a configuração está `enabled = true`?
3. o `mode` ativo confere com os IDs preenchidos?
4. o evento está `enabled = true` no admin?
5. o `trigger` configurado bate exatamente com o trigger emitido no frontend?
6. no modo `direct`, o `fbq` foi inicializado?
7. no modo `gtm`, o `dataLayer` recebeu o evento esperado?
8. o `payloadJson` é JSON válido e compatível com o evento esperado?

## Relações com outras partes do domínio

- cardápio público: `app/domain/cardapio/*`
- engajamento nativo do cardápio: `engagement-settings.server.ts`, `menu-item-interest/*`
- botão de pedido: `components/fazer-pedido-button/fazer-pedido-button.tsx`

Se a estratégia de tracking do cardápio crescer muito no futuro, o próximo passo natural é mover esses arquivos para uma subpasta dedicada, por exemplo `app/domain/cardapio/facebook-pixel/`.
