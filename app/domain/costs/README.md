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

## Arquitetura Atual

### Modulos principais

- `item-cost-snapshot.server.ts`
  - resolve `ultimo custo` e `custo medio` do insumo.
- `recipe-cost-recalc.server.ts`
  - recalcula snapshots de custo de linhas de receita.
- `item-cost-sheet-recalc.server.ts`
  - recalcula componentes e totais de ficha tecnica.
- `cost-impact-graph.server.ts`
  - descobre dependencias impactadas por um insumo alterado.
- `menu-item-cost-sync.server.ts`
  - sincroniza custo do produto comercial em `MenuItemCostVariation`.
- `menu-item-margin-impact.server.ts`
  - le margem atual, margem alvo e preco recomendado do `MenuItem`.
- `cost-impact-pipeline.server.ts`
  - executa a cadeia completa de propagacao e persistencia do impacto.

### Fluxo resumido

1. A NF ou outra alteracao muda o custo do insumo.
2. O pipeline monta o grafo de dependencias.
3. Receitas afetadas sao recalculadas.
4. Fichas tecnicas afetadas sao recalculadas.
5. Custos do `MenuItem` sao sincronizados.
6. O impacto de margem e calculado.
7. O resultado e persistido em `CostImpactRun` e `CostImpactMenuItem`.

## Plano Tecnico

### Fase 1

Unificar a regra de custo do insumo.

Entregue:

- snapshot padronizado de custo;
- recalc de receita extraido;
- recalc de ficha extraido.

### Fase 2

Propagar custo em cascata.

Entregue:

- grafo de impacto;
- pipeline de propagacao;
- integracao no fluxo de entrada de estoque;
- sincronizacao do custo comercial em `MenuItem`.

### Fase 3

Persistir e visualizar impacto.

Entregue:

- tabelas `CostImpactRun` e `CostImpactMenuItem`;
- painel administrativo inicial;
- filtros operacionais basicos;
- organizacao do menu administrativo para custos e margem.

## Plano de Desenvolvimento

### Convencoes

- toda regra de negocio de custo deve nascer em `app/domain/costs/`;
- modulos antigos fora de `costs` podem existir apenas como compat layer temporaria;
- regras de rota nao devem reimplementar calculo de custo;
- recalc e propagacao devem ser chamados por servicos de dominio, nao por codigo duplicado em rotas.

### Ordem recomendada para evolucao

1. Manter `costs` como ponto central de toda regra nova.
2. Migrar chamadas restantes para os imports de `~/domain/costs/...`.
3. Aumentar cobertura de testes de pipeline e sincronizacao comercial.
4. Validar performance da propagacao para itens com alta fan-out.
5. Preparar a transicao de `MenuItem` para `Item` como futura fonte de verdade comercial.

## Estado Atual

### Ja implementado

- snapshot unico de custo do insumo;
- recalc de receita;
- recalc de ficha tecnica;
- pipeline de impacto;
- persistencia do impacto;
- painel inicial de impacto;
- sincronizacao do custo comercial em `MenuItem`.

### Limitacoes conhecidas

- a fonte de verdade comercial ainda e `MenuItem`, nao `Item`;
- ainda ha adaptacoes futuras para quando o vendido no cardapio migrar para `Item`;
- a validacao pratica de casos pesados de propagacao comercial pode exigir execucao mais longa no ambiente;
- ainda existe compatibilidade temporaria com paths antigos fora de `costs`.

## Decisao de Arquitetura

Decisao atual:

- `MenuItem` continua sendo a referencia oficial do vendido no cardapio;
- `costs` e o dominio central para regra de custo, impacto e margem;
- a migracao futura para `Item` deve ser tratada como uma evolucao arquitetural separada, com adaptacoes explicitas.
