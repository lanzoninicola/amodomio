# Costs Domain

## Objetivo

Centralizar a regra de negocio ligada a:

- custo de insumos;
- custo de fichas tecnicas;
- propagacao de impacto de custo;
- sincronizacao de custo do item vendido no cardapio;
- leitura de margem e preco sugerido.

O objetivo do dominio `costs` e permitir que uma alteracao de custo de insumo chegue, de forma rastreavel, ate a analise de margem dos produtos vendidos.

A origem principal de alteracao de custo hoje e o journal canonico em `stock-movement`.
Ver: [app/domain/stock-movement/README.md](../stock-movement/README.md)

## Regra de Negocio

### Objetivo operacional

O negocio quer acompanhar ativamente os custos dos insumos para agir nos precos de venda e proteger a margem.

Por isso, o sistema trabalha com duas leituras de custo:

- `ultimo custo`: leitura mais recente, usada para reagir rapido a mudancas recentes;
- `custo medio`: leitura mais estavel, usada para analise e decisao de preco com menos ruido.

### Regras principais

1. Um evento canônico de custo deve atualizar o custo corrente do insumo.
2. Essa alteracao deve impactar a base de custo usada pelas fichas tecnicas.
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
- `import`: custo vindo de importacao de NF;
- `adjustment`: correcao operacional interna;
- `item-cost-sheet`: snapshot calculado por ficha de custo.

Convencao atual de persistencia:

- `manual`, `import`, `adjustment` e `item-cost-sheet` devem gerar um `StockMovement`;
- quando nao houver movimento fisico, o evento usa `direction = neutral`;
- `ItemCostVariationHistory` referencia esse evento com `referenceType = "stock-movement"`.

Convencao atual:

- a lista canonica deve viver em `app/domain/costs/item-cost-sources.ts`;
- UI deve consumir labels e hints desse modulo, sem redefinir valores localmente;
- novas origens devem ser documentadas aqui ao serem introduzidas.

### Fonte de verdade atual

A fonte de verdade do produto vendavel e o conjunto nativo de `Item`.

Na pratica, isso significa:

- a identidade do produto vendido parte de `Item` + `ItemVariation`;
- os atributos comerciais/publicos partem de `ItemSellingInfo`;
- os precos de venda nativos partem de `ItemSellingPriceVariation`;
- o custo operacional parte de `ItemCostVariation` e `ItemCostVariationHistory`.

`MenuItem` e `MenuItem*` permanecem no sistema como camadas legadas de compatibilidade e como projeções ainda consumidas por areas nao migradas.

### Compatibilidade legada atual

Alguns fluxos ainda dependem de projeções legadas em `MenuItem`, especialmente:

- sincronizacao de custo para `MenuItemCostVariation`;
- calculo de impacto/margem em painéis antigos;
- telas administrativas antigas que ainda leem `MenuItemSellingPriceVariation`.

Essas projeções nao definem mais a modelagem canonica do produto comercial. Elas existem para sustentar compatibilidade durante a transicao.

## Pipeline de Impacto de Custo

### Gatilho

O cálculo de impacto ocorre **em tempo real**, sob demanda, quando o dashboard `admin.cost-impact` e carregado. Nao ha enfileiramento de job nem escrita em banco nesse fluxo.

O loader da rota:

1. Lê o `ItemCostVariationHistory` dos últimos 60 dias (ou o valor configurado em `getItemAverageCostWindowDays`).
2. Agrupa por `itemId`, mantendo a entrada mais recente de cada item.
3. Filtra os insumos com variação de custo significativa (diferença a partir da 4ª casa decimal).
4. Para cada insumo com variação, chama `buildCostImpactGraphForItem` para obter os `menuItemIds` afetados.
5. Chama `listMenuItemMarginImpactRows` com o conjunto de ids e aplica `resolvePriority` em cada linha.

Os filtros de canal, variação, prioridade, busca e meta são aplicados em memória sobre o resultado.

### Grafo de impacto

`buildCostImpactGraphForItem` parte do insumo alterado e traversa as dependencias em cascata:

1. Receitas que usam o insumo como ingrediente (`recipeIngredient → recipe`).
2. Itens intermediarios gerados por essas receitas (`recipe → item`).
3. Fichas de custo (`itemCostSheet`) com dependencia direta ou indireta, via `itemCostSheetComponent` do tipo `recipeSheet`.
4. Projecoes legadas de cardapio (`menuItem`) vinculadas a qualquer item do grafo, quando o fluxo ainda depende dessa compat layer.

### Recalculo em cascata

Apos montar o grafo, o pipeline recalcula na ordem correta:

1. `recalcItemCostSheetTotals` — recalcula componentes e totais das fichas de custo afetadas. Componentes do tipo `recipe` usam a composicao atual da receita como fonte estrutural e resolvem o custo dos insumos em tempo de recálculo; componentes do tipo `recipeSheet` usam o total da ficha dependente.
2. `syncMenuItemCostsForItems` — sincroniza uma projeção legada em `MenuItemCostVariation` para cada tamanho do `MenuItem`. Usa a ficha ativa do item como base. Se nao houver ficha por tamanho exato, deriva proporcoes a partir do custo da variacao de referencia (`pizza-medium`).

### Papel da Recipe

`Recipe` nao persiste valores monetarios de custo e nao e fonte financeira.

Na modelagem atual:

- `Recipe` guarda estrutura de producao: insumos, quantidades, UM, perdas e variacoes;
- `ItemCostSheet` calcula e persiste o custo operacional;
- uma linha `recipe` na ficha usa a composicao atual da receita para resolver o custo dos insumos no momento do recálculo.

Isso evita duplicar custo em `Recipe` e `ItemCostSheet`, mantendo a receita como fonte estrutural e a ficha como fonte financeira.

### Calculo de impacto na margem

`listMenuItemMarginImpactRows` compara o custo atualizado com o preco de venda atual dentro da camada legada ainda usada por alguns painéis e calcula:

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

O dashboard de impacto **nao grava dados**. O resultado e efemero: calculado a cada requisicao e descartado apos a resposta.

As tabelas `CostImpactRun` e `CostImpactMenuItem` permanecem no banco como historico de execucoes anteriores, mas nao sao mais alimentadas pelo fluxo normal. `runCostImpactPipelineForItemChange` (que persiste nessas tabelas) ainda existe em `cost-impact-pipeline.server.ts` e pode ser acionado sob demanda no futuro, mas nao e chamado automaticamente.

## Arquitetura Atual

### Modulos principais

- `item-cost-snapshot.server.ts`
  — resolve `ultimo custo` e `custo medio` do insumo a partir do historico de `ItemCostVariationHistory`.
- `item-cost-sheet-recalc.server.ts`
  — recalcula componentes e totais de ficha tecnica, inclusive linhas `recipe` a partir da composicao atual da receita.
- `cost-impact-graph.server.ts`
  — descobre dependencias impactadas por um insumo alterado.
- `menu-item-cost-sync.server.ts`
  — sincroniza a projeção legada de custo em `MenuItemCostVariation`.
- `menu-item-margin-impact.server.ts`
  — le margem atual, margem alvo e preco recomendado na projeção legada baseada em `MenuItem`.
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
- `app/domain/item/item-cost-snapshot.server.ts`

Novas referencias devem usar `~/domain/costs/` diretamente.

## Estado Atual

### Ja implementado

- snapshot unico de custo do insumo;
- recalc de ficha tecnica;
- grafo de impacto em cascata;
- pipeline de propagacao (disponivel para uso sob demanda);
- dashboard de impacto em tempo real (`admin.cost-impact`);
- sincronizacao da projeção legada de custo em `MenuItem`.

### Limitacoes conhecidas

- alguns painéis de impacto/margem ainda leem projeções `MenuItem`, embora a modelagem canonica ja esteja em `Item`;
- a sincronizacao de custo legada so ocorre se existir ficha de custo ativa para o item — itens sem ficha nao propagam para `MenuItem`;
- a propagacao em cascata e sequencial; itens com alto fan-out (muitas receitas dependentes) podem ser lentos;
- compat layers fora de `costs/` ainda existem e devem ser migrados.

## Decisao de Arquitetura

- `Item` e a referencia canonica do produto vendavel e do estado comercial atual;
- `costs` e o dominio central para toda regra de custo, impacto e margem;
- projeções `MenuItem*` continuam existindo apenas para compatibilidade e para painéis ainda nao migrados;
- a pasta `cost-impact/` foi eliminada — os shims eram re-exports sem consumidores e o teste foi movido para `costs/`;
- o impacto de custo e calculado em tempo real no dashboard, sem persistencia;
- `CostImpactRun` e `CostImpactMenuItem` sao mantidas no banco apenas como historico;
- a limpeza final da camada `MenuItem*` deve ser tratada como reducao de compatibilidade residual, nao como migracao da fonte de verdade.
