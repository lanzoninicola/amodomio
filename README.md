# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

Start the Remix development asset server and the Express server by running:

```sh
npm run dev
```

This starts your app in development mode, which will purge the server require cache when Remix rebuilds assets so you don't need a process manager restarting the express server.

## Prisma

Prisma configuration, env vars, and migration notes are documented in:

- `prisma/README.md`

## KDS REST API

Documentação da API REST do KDS (criação de pedidos e delivery zones):

- `app/domain/kds/README.md`

## Domínio Cardápio (ItemCostSheet)

Regras de modelagem para evitar duplicação entre `Recipe` (base técnica) e `ItemCostSheet` (aplicação comercial por item+variação):

- `app/domain/cardapio/item-cost-sheet/README.md`

## Gerenciamento de Custos por Classificação (Estado Atual)

Referência rápida para evolução futura do fluxo de custos por `Item`.

### Classificações existentes

- `insumo`
- `semi_acabado`
- `produto_final`
- `embalagem`
- `servico`
- `outro`

### Regra geral atual

- O custo é gerenciado principalmente por `Item`, via histórico em `ItemCostHistory`.
- O cadastro manual de custo é genérico (não aplica regra diferente por classificação no backend).
- O sistema calcula `último custo` e `custo médio` por item, com normalização por unidade quando há configuração de compra/consumo.

### Como está sendo usado por classificação (hoje)

- `insumo`: normalmente custo manual/compra alimentando `ItemCostHistory`.
- `semi_acabado`: custo operacional deve vir de `ItemCostSheet` (ficha de custo), por referência.
- `produto_final`: custo operacional do cardápio/precificação deve vir de `ItemCostSheet` ativa por item+variação.
- `embalagem`: pode ter custo próprio no `ItemCostHistory` e também compor custo específico de venda em ficha técnica.
- `servico`: usa o fluxo genérico de custo por item (sem regra específica de classificação no cadastro de custo).
- `outro`: usa o fluxo genérico de custo por item.

### Observações importantes

- A classificação hoje é mais organizacional/semântica e de fluxo do que uma trava de cadastro de custo.
- Existe sincronização de snapshot de custo de `ItemCostSheet` ativa para `ItemCostHistory` (fonte `item-cost-sheet`) quando aplicável.
- Este bloco documenta o comportamento atual e pode ser refinado quando o fluxo por classificação for formalizado.

### Último custo e custo médio (como é gerenciado hoje)

- `Último custo`:
  - vem do registro mais recente em `ItemCostHistory` (ordenação por `validFrom` desc e depois `createdAt` desc)
  - pode ter origem manual (aba `Custos`) ou automática (`source = item-cost-sheet`)

- `Custo médio`:
  - é calculado por item com base nos registros de `ItemCostHistory` dentro de uma janela de dias configurável
  - a configuração fica em `setting` com `context=items.cost` e `name=averageWindowDays` (default `30`)
  - o cálculo usa a normalização para unidade de consumo quando o item possui:
    - unidade de compra
    - unidade de consumo
    - fator de conversão (`purchaseToConsumptionFactor`)

- Regras de normalização (resumo):
  - se o custo já estiver na unidade de consumo, usa o valor direto
  - se o custo estiver na unidade de compra e houver fator de conversão válido, converte para unidade de consumo
  - se `source = item-cost-sheet` e a unidade vier vazia, o valor é tratado como custo já normalizado do item
  - se não for possível normalizar, o registro não entra no cálculo do custo médio

- Frequência de atualização (estado atual):
  - não há agendamento automático por classificação
  - a atualização é por evento (registro manual de custo ou sincronização de `ItemCostSheet`)
  - `último custo` reflete imediatamente o novo lançamento em `ItemCostHistory`
- `custo médio` é recalculado na leitura/tela com base no histórico e na janela configurada

## Desenho Final de Gerenciamento de Custos (Item + Variações)

Objetivo: ter uma única fonte de verdade para custo atual e histórico, cobrindo tanto `Item` base quanto variações de `Item` (ex.: tamanho, embalagem, etc.), sem depender de `MenuItem`/`MenuItemSize`.

### Princípios

- `MenuItem` é domínio comercial/venda e não é a identidade do custo.
- O custo pertence ao `Item` e, quando existir, à sua `variação`.
- O custo atual e o histórico devem usar o mesmo eixo de identificação (`ItemVariation`).
- `ItemCostHistory` legado continua válido para histórico antigo, mas o novo fluxo usa `ItemCostVariation` + `ItemCostVariationHistory`.

### Modelos (novo fluxo)

- `Variation` (catálogo global de variações)
  - `id`
  - `kind` (ex.: `base`, `size`, `packaging`)
  - `code` (ex.: `base`, `pizza-medium`)
  - `name`
  - `createdAt`, `updatedAt`, `deletedAt`

- `ItemVariation` (vínculo do item com uma variação do catálogo)
  - `id`
  - `itemId` (obrigatório)
  - `variationId` (obrigatório)
  - `createdAt`, `updatedAt`, `deletedAt`

- `ItemCostVariation` (fonte única de custo atual por variação)
  - `id`
  - `itemVariationId` (obrigatório, único)
  - `costAmount`
  - `previousCostAmount`
  - `unit`
  - `source` (`manual`, `purchase`, `item-cost-sheet`, `import`, `adjustment`, etc.)
  - `referenceType`, `referenceId`
  - `validFrom`
  - `updatedBy`
  - `createdAt`, `updatedAt`, `deletedAt`

- `ItemCostVariationHistory` (snapshot/auditoria)
  - `id`
  - `itemVariationId`
  - `costAmount`
  - `previousCostAmount`
  - `unit`
  - `source`
  - `referenceType`, `referenceId`
  - `validFrom`
  - `createdBy`
  - `metadata` (JSON)
  - `createdAt`, `updatedAt`

### Invariantes de negócio

- Todo `Item` deve ter uma variação base:
  - `Variation(kind=base, code=base)`
  - um vínculo correspondente em `ItemVariation`
- Não remover a variação base de um item.
- `ItemCostVariation` mantém exatamente 1 custo atual por `ItemVariation`.
- Toda atualização de `ItemCostVariation` gera snapshot em `ItemCostVariationHistory` na mesma transação.
- `validFrom` representa quando o custo passa a valer (e não apenas quando foi gravado).

### Fluxos operacionais

- Custo manual/compra de item base:
  - resolve `ItemVariation` base do item
  - atualiza `ItemCostVariation`
  - grava snapshot em `ItemCostVariationHistory`

- Custo derivado de ficha técnica (ex.: tamanho):
  - resolve a `ItemVariation` correspondente (ex.: `kind=size`, `code=pizza-medium`)
  - atualiza `ItemCostVariation` com `source=item-cost-sheet`
  - grava snapshot com `referenceType/referenceId` da origem

- Consulta de custo atual:
  - ler sempre de `ItemCostVariation`

- Consulta de trilha histórica:
  - ler de `ItemCostVariationHistory`

### Estado de transição / compatibilidade

- `MenuItemCostVariation` pode existir temporariamente como projeção/cache de compatibilidade.
- O novo fluxo de custo deve convergir para `ItemCostVariation`.
- `MenuItemSize` e `menuItemId` não entram na identidade canônica do custo no desenho final.

### Implementação base (entities)

- `app/domain/item/variation.prisma.entity.server.ts`
  - CRUD de `Variation`
  - `ensureBaseVariation()`

- `app/domain/item/item-variation.prisma.entity.server.ts`
  - vínculo/remoção lógica de `ItemVariation`
  - regra de proteção da variação base
  - `ensureBaseVariationForItem(itemId)`

- `app/domain/item/item-cost-variation.prisma.entity.server.ts`
  - custo atual por variação
  - snapshots em histórico na mesma transação
  - consultas por `itemVariationId` e por `itemId`

## Painel WhatsApp Sem Resposta (Admin)

O painel flutuante de alertas no admin lista conversas que precisam de ação do atendente.

### Regra de exibição

- A lista considera eventos do dia (timezone `America/Sao_Paulo`).
- Para cada cliente, avalia o último evento registrado.
- O cliente aparece no painel quando o último evento é `WHATSAPP_SENT` e já passou o tempo mínimo (`DEFAULT_REPLY_WAIT_SECONDS`, hoje `90s`).
- Se o último evento for `WHATSAPP_RECEIVED`, o cliente não aparece no painel.

### Resposta rápida via Settings

O botão de resposta rápida usa mensagem configurável em `setting`:

- `context=whatsapp-no-response`
- `name=quick-reply-message`

Compatibilidade legada:

- `context=admin-wpp-alert-panel` (fallback de leitura)

Implementação:

- `app/routes/admin.tsx` (loader/query do painel)
- `app/routes/api.admin-wpp-alerts.tsx` (ações e leitura da mensagem)

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying express applications you should be right at home just make sure to deploy the output of `remix build`

- `build/`
- `public/build/`

### Using a Template

When you ran `npx create-remix@latest` there were a few choices for hosting. You can run that again to create a new project, then copy over your `app/` folder to the new project that's pre-configured for your target server.

```sh
cd ..
# create a new project, and pick a pre-configured host
npx create-remix@latest
cd my-new-remix-app
# remove the new project's app (not the old one!)
rm -rf app
# copy your app over
cp -R ../my-old-remix-app/app app
```

## Proteção de Merge no `vercel-prod`

Para reduzir risco de deploy com falha no cardápio público, o projeto usa dois checks:

1. `Vercel Prod Loader Guard` (`.github/workflows/vercel-prod-loader-guard.yml`)
2. `Cardapio Loader Smoke` (`.github/workflows/cardapio-loader-smoke.yml`)

### O que cada check valida

- `Vercel Prod Loader Guard`:
  - roda em `pull_request` para `vercel-prod`
  - executa `app/routes/cardapio._index.loader.test.ts`
  - garante comportamento esperado do loader blocante do cardápio

- `Cardapio Loader Smoke`:
  - roda em `deployment_status` (após deploy bem-sucedido da Vercel)
  - valida a rota `/cardapio` no preview
  - falha se detectar contingência ativa (`Redirecionamento automático`)

### Configuração recomendada no GitHub

Em `Settings > Branches > Branch protection rules` para `vercel-prod`:

1. Ativar `Require status checks to pass before merging`
2. Marcar como obrigatórios:
   - `Vercel Prod Loader Guard / cardapio-loader-blocker-test`
   - `Cardapio Loader Smoke / smoke-cardapio-loader`

### Observação sobre simulação de erro

O setting `context=cardapio`, `name=contingencia.simula.erro`, `value=true` força a contingência.
Se estiver ativo em preview/deploy, os checks podem falhar por design.
