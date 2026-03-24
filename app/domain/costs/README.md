# Costs Domain

## Objetivo

Centralizar a regra de negocio ligada a:

- custo de insumos;
- custo de receitas;
- custo de fichas tecnicas;
- propagacao de impacto de custo;
- sincronizacao de custo do item vendido no cardapio;
- leitura de margem e preco sugerido.

O objetivo do dominio `costs` e permitir que uma alteracao de custo de insumo chegue, de forma rastreavel, ate a analise de margem dos produtos vendidos.

A origem principal de alteracao de custo hoje e a importacao de nota fiscal via `stock-movement`.
Ver: [app/domain/stock-movement/README.md](../stock-movement/README.md)

## Regra de Negocio

### Objetivo operacional

O negocio quer acompanhar ativamente os custos dos insumos para agir nos precos de venda e proteger a margem.

Por isso, o sistema trabalha com duas leituras de custo:

- `ultimo custo`: leitura mais recente, usada para reagir rapido a mudancas recentes;
- `custo medio`: leitura mais estavel, usada para analise e decisao de preco com menos ruido.

### Regras principais

1. Uma entrada de estoque deve atualizar o custo corrente do insumo.
2. Essa alteracao deve impactar a base de custo usada por receitas e fichas.
3. O impacto deve poder chegar ate o item vendido no cardapio.
4. O sistema deve permitir comparar:
   - custo atual;
   - preco atual;
   - margem atual;
   - margem alvo;
   - preco recomendado.

### Origens de custo

As leituras de custo do item carregam uma origem operacional padronizada.

Valores atuais:

- `manual`: levantamento avulso ou conferencia manual;
- `purchase`: custo confirmado em compra;
- `import`: custo vindo de importacao de NF;
- `adjustment`: correcao operacional interna;
- `item-cost-sheet`: snapshot calculado por ficha de custo.

Convencao atual:

- a lista canonica deve viver em `app/domain/costs/item-cost-sources.ts`;
- UI deve consumir labels e hints desse modulo, sem redefinir valores localmente;
- novas origens devem ser documentadas aqui ao serem introduzidas.

### Fonte de verdade atual

No momento, a fonte de verdade do produto vendido no cardapio e o `MenuItem`.

Isso significa:

- o item comercial exibido e vendido no cardapio e derivado de `MenuItem`;
- o custo operacional do vendido no cardapio e sincronizado em `MenuItemCostVariation`;
- a leitura de margem e preco de venda e feita a partir da estrutura de `MenuItem`.

### Direcao futura

No futuro, a fonte de verdade deve migrar para `Item`, com as devidas adaptacoes.

Essa mudanca ainda nao foi concluida. Quando acontecer, sera necessario:

- tratar `Item` como entidade principal do produto vendavel;
- revisar dependencias entre `Item`, `MenuItem`, receita, ficha e preco;
- reduzir a duplicacao de camada comercial hoje concentrada em `MenuItem`;
- adaptar a sincronizacao de custo e a leitura de margem para a nova origem.

Enquanto essa migracao nao acontece, toda a cadeia de custo comercial deve continuar respeitando `MenuItem` como referencia oficial.

## Pipeline de Impacto de Custo

### Gatilho

Cada linha importada com sucesso pelo `stock-movement` enfileira um async job `costImpactRecalc` para o `itemId` afetado. O job e executado pelo cron `api.async-jobs-cron` e chama `runCostImpactPipelineForItemChange`.

O job usa `dedupeKey = cost_impact_recalc:item:{itemId}` para evitar execucoes redundantes enquanto um job do mesmo item ainda esta pendente.

### Grafo de impacto

`buildCostImpactGraphForItem` parte do insumo alterado e traversa as dependencias em cascata:

1. Receitas que usam o insumo como ingrediente (`recipeIngredient → recipe`).
2. Itens intermediarios gerados por essas receitas (`recipe → item`).
3. Fichas de custo (`itemCostSheet`) com dependencia direta ou indireta, via `itemCostSheetComponent` do tipo `recipeSheet`.
4. Itens de cardapio (`menuItem`) vinculados a qualquer item do grafo.

### Recalculo em cascata

Apos montar o grafo, o pipeline recalcula na ordem correta:

1. `recalcRecipeCosts` — atualiza o snapshot de custo de cada linha de receita afetada usando `ultimo custo` e `custo medio` do insumo. O custo de linha considera percentual de perda (`lossPct`).
2. `recalcItemCostSheetTotals` — recalcula componentes e totais das fichas de custo afetadas. Componentes do tipo `recipe` usam o snapshot da receita; componentes do tipo `recipeSheet` usam o total da ficha dependente.
3. `syncMenuItemCostsForItems` — sincroniza o custo calculado em `MenuItemCostVariation` para cada tamanho do `MenuItem`. Usa a ficha ativa do item como base. Se nao houver ficha por tamanho exato, deriva proporcoes a partir do custo da variacao de referencia (`pizza-medium`).

### Calculo de impacto na margem

`listMenuItemMarginImpactRows` compara o custo atualizado com o preco de venda atual e calcula:

- `profitActualPerc`: margem efetiva atual apos a mudanca de custo;
- `profitExpectedPerc`: margem alvo configurada no item;
- `priceGapAmount`: diferenca entre preco recomendado e preco atual;
- `marginGapPerc`: diferenca entre margem alvo e margem efetiva;
- `recommendedPriceAmount`: preco minimo com lucro calculado pelo handler de preco de venda.

So entram no resultado linhas com variacao de custo significativa (diferenca a partir da 4a casa decimal).

### Classificacao de prioridade

`resolvePriority` classifica a urgencia da revisao de preco:

| Prioridade | Condicao |
|------------|----------|
| `critical` | `marginGapPerc >= 10` ou `priceGapAmount >= 15` |
| `high`     | `marginGapPerc >= 5` ou `priceGapAmount >= 7`  |
| `medium`   | `marginGapPerc >= 2` ou `priceGapAmount >= 3`  |
| `low`      | abaixo disso |

### Persistencia

O resultado e salvo em:

- `CostImpactRun`: registro da execucao com contadores de receitas, fichas e itens de cardapio afetados.
- `CostImpactMenuItem`: uma linha por variacao de cardapio afetada, com custo atual, custo anterior, preco de venda, margem e prioridade.

Se as tabelas nao existirem no banco (ex: ambiente de teste sem migracao), a persistencia e silenciosamente ignorada e o pipeline continua.

## Arquitetura Atual

### Modulos principais

- `item-cost-snapshot.server.ts`
  — resolve `ultimo custo` e `custo medio` do insumo a partir do historico de `ItemCostVariationHistory`.
- `recipe-cost-recalc.server.ts`
  — recalcula snapshots de custo das linhas de receita.
- `item-cost-sheet-recalc.server.ts`
  — recalcula componentes e totais de ficha tecnica.
- `cost-impact-graph.server.ts`
  — descobre dependencias impactadas por um insumo alterado.
- `menu-item-cost-sync.server.ts`
  — sincroniza custo do produto comercial em `MenuItemCostVariation`.
- `menu-item-margin-impact.server.ts`
  — le margem atual, margem alvo e preco recomendado do `MenuItem`.
- `cost-impact-pipeline.server.ts`
  — executa a cadeia completa de propagacao e persistencia do impacto.
- `cost-impact-pipeline.server.test.ts`
  — testes unitarios do pipeline com mocks das dependencias.
- `item-cost-sources.ts`
  — lista canonica de origens de custo.

### Compat layers existentes

Os arquivos abaixo sao re-exports temporarios mantidos por compatibilidade enquanto os consumidores nao foram migrados para `~/domain/costs/` diretamente:

- `app/domain/cardapio/menu-item-cost-sync.server.ts`
- `app/domain/cardapio/menu-item-margin-impact.server.ts`
- `app/domain/item-cost-sheet/item-cost-sheet-recalc.server.ts`
- `app/domain/recipe/recipe-cost-recalc.server.ts`
- `app/domain/item/item-cost-snapshot.server.ts`

Novas referencias devem usar `~/domain/costs/` diretamente.

## Estado Atual

### Ja implementado

- snapshot unico de custo do insumo;
- recalc de receita;
- recalc de ficha tecnica;
- grafo de impacto em cascata;
- pipeline de propagacao;
- persistencia do impacto em `CostImpactRun` e `CostImpactMenuItem`;
- painel inicial de impacto;
- sincronizacao do custo comercial em `MenuItem`;
- integracao via async job disparado pelo `stock-movement`.

### Limitacoes conhecidas

- a fonte de verdade comercial ainda e `MenuItem`, nao `Item`;
- a sincronizacao de custo so ocorre se existir ficha de custo ativa para o item — itens sem ficha nao propagam para `MenuItem`;
- a propagacao em cascata e sequencial; itens com alto fan-out (muitas receitas dependentes) podem ser lentos;
- compat layers fora de `costs/` ainda existem e devem ser migrados.

## Decisao de Arquitetura

- `MenuItem` continua sendo a referencia oficial do vendido no cardapio;
- `costs` e o dominio central para toda regra de custo, impacto e margem;
- a pasta `cost-impact/` foi eliminada — os shims eram re-exports sem consumidores e o teste foi movido para `costs/`;
- a migracao futura para `Item` deve ser tratada como uma evolucao arquitetural separada, com adaptacoes explicitas.
