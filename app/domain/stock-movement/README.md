# Stock Movement

## Objetivo

O dominio `stock-movement` registra a trilha canonica de eventos que alteram custo e, quando aplicavel, a movimentacao fisica de estoque.

O fluxo principal hoje e a importacao via payload estruturado gerado pelo fluxo mobile de foto/cupom (`admin.mobile.entrada-estoque-foto`). O suporte a planilha `.xlsx` do Saipos tambem existe e converge para o mesmo pipeline.

Ele cobre:

- criacao de lote a partir de payload estruturado do fluxo mobile de foto;
- criacao de lote a partir de planilha `.xlsx` exportado do Saipos;
- eventos canonicos de custo manual e ficha de custo;
- conciliacao de fornecedor via JSON gerado por extensao do navegador, por JSON posterior ou manualmente;
- mapeamento de ingrediente para `Item`, inclusive com criacao de item no fluxo do lote;
- resolucao de conversao de unidade e custo;
- importacao incremental das linhas prontas para estoque;
- registro de alteracoes aplicadas para rollback e auditoria;
- deduplicacao por `sourceFingerprint`;
- consulta administrativa das movimentacoes geradas;
- atualizacao de custo do insumo como base para o calculo de impacto de margem.

## Entradas suportadas

1. `createStockMovementImportBatchFromVisionPayload`
   Lote criado a partir do payload estruturado do fluxo `admin.mobile.entrada-estoque-foto`. Entrada principal em uso.
2. `createStockMovementImportBatchFromFile`
   Lote criado a partir de planilha `.xlsx` de entrada de estoque por documento.

As duas entradas convergem para o mesmo modelo de lote, a mesma classificacao de linha e a mesma rotina de importacao para estoque.

## Conciliacao de fornecedor via extensao do navegador

O `.xlsx` exportado do Saipos nao contem o fornecedor das entradas. O Saipos tambem nao permite exportar esse dado diretamente para Excel. Para resolver isso, existe uma extensao do navegador que le o relatorio de entradas dentro do proprio Saipos e extrai, por linha, o par `numero da nota fiscal → fornecedor`.

O **numero da nota fiscal** e a chave de vinculo entre as linhas da planilha e os fornecedores. O JSON gerado pela extensao e anexado ao lote para realizar a conciliacao.

## Pipeline atual

1. Ler a origem e normalizar as linhas.
2. Gerar `sourceFingerprint` por documento, item, quantidade e custo.
3. Tentar conciliar fornecedor.
4. Tentar mapear ingrediente para item por alias/nome.
5. Resolver conversao de unidade e custo.
6. Classificar a linha.
7. Persistir o lote com `summary`.
8. Importar para estoque apenas linhas `ready` que tambem entram em `summary.readyToImport`.
9. Criar `stock_nf_import_applied_changes` e `stock_movements`.

## Direcao e tipo

Os eixos canonicos sao:

- `direction`: `entry | exit | neutral`
- `movementType`: `import | manual | adjustment | item-cost-sheet`

Regra:

- eventos sem movimentacao fisica usam `direction = neutral`;
- o recalc de correcao historica continua restrito aos eventos de `movementType = import`.

## Status de linha

- `ready`: item mapeado, conversao resolvida e apta para importacao quando o fornecedor estiver conciliado.
- `pending_mapping`: ingrediente ainda sem item do sistema.
- `pending_supplier`: leitura operacional derivada do resumo/UI; nao e status persistido proprio da linha.
- `pending_conversion`: unidade ou fator ainda nao resolvido.
- `invalid`: documento, data, motivo ou custo invalidos.
- `ignored`: linha removida manualmente do fluxo.
- `skipped_duplicate`: fingerprint ja apareceu no lote atual ou em importacao anterior ainda ativa.
- `error`: falha de processamento ou falha de importacao.
- `imported`: linha ja virou movimentacao de estoque e nao deve ser importada novamente.

## Status de lote

- `draft`: ainda existe alguma pendencia operacional.
- `validated`: lote sem pendencias pre-apply.
- `partial`: lote aplicado parcialmente, mas ainda com pendencias ou erros.
- `applied`: lote totalmente aplicado.
- `rolled_back`: lote revertido.

## Resumo do lote

O `summary` consolidado do lote usa hoje:

- `total`
- `ready`
- `readyToImport`
- `invalid`
- `pendingMapping`
- `pendingSupplier`
- `pendingConversion`
- `imported`
- `ignored`
- `skippedDuplicate`
- `error`

Ponto importante:

- `ready` significa linha tecnicamente classificada como pronta;
- `readyToImport` significa linha que de fato pode entrar na importacao atual, considerando a conciliacao de fornecedor.

## Conciliacao de fornecedor

O lote guarda metadados explicitos da etapa de conciliacao:

- `supplier_notes_file_name`
- `supplier_notes_attached_at`
- `supplier_reconciliation_status`
- `supplier_reconciliation_source`
- `supplier_reconciliation_at`

Regras atuais:

- o JSON de fornecedores gerado pela extensao do navegador pode ser anexado no upload inicial do lote ou depois no detalhe do lote;
- a chave de join entre o JSON e as linhas do lote e o numero da nota fiscal;
- conciliacao manual prevalece sobre uma nova reaplicacao do JSON;
- sem conciliacao suficiente, a linha nao entra em `readyToImport`.

## Mapeamento de item

Regras atuais:

- a linha pode nascer mapeada por alias ou por nome normalizado;
- o usuario pode mapear um item manualmente no lote;
- o usuario pode criar um item novo e ja vincular a linha;
- o mapeamento manual pode ser aplicado para todas as linhas com o mesmo ingrediente no lote;
- quando solicitado, o alias pode ser salvo para reaproveitamento futuro.

## Conversao e custo

Ordem atual de resolucao:

1. mesma unidade;
2. fator manual da linha;
3. fator de compra/consumo do item;
4. tabela global de conversao de unidades;
5. pendencia manual.

Regras atuais:

- o custo importado vai para a variacao principal do item;
- a referencia de custo gravada e `stock-movement-import-line`;
- o snapshot anterior fica salvo em `stock_nf_import_applied_changes`;
- a movimentacao gerada tambem preserva os metadados da origem importada.

## Importacao incremental

A importacao nao roda como uma unica operacao pesada no request principal.

Fluxo atual:

1. `startStockMovementImportBatch` marca o lote como `importing`.
2. A rota `api.admin-stock-import-batch-import-step` chama `importStockMovementImportBatchStep`.
3. Cada chamada processa um pequeno bloco de linhas.
4. A tela do lote faz polling, revalida o loader e atualiza o progresso.

Campos de progresso:

- `import_status` — `idle | importing | imported | failed`
- `import_started_at`
- `import_finished_at`
- `import_processed_count`
- `import_error_count`
- `import_total_count`
- `import_message`

Observacao operacional:

- hoje a experiencia depende da pagina do lote permanecer aberta durante a importacao.

## Impacto de custo apos importacao

O custo do insumo e atualizado diretamente via `setCurrentCost` e o impacto sobre a margem do cardapio e calculado em tempo real no dashboard `admin.cost-impact`.

O dashboard le o `ItemCostVariationHistory` dos ultimos 60 dias, detecta variacoes significativas por insumo e monta o grafo de dependencias para exibir custo, margem e prioridade de revisao de preco de cada item afetado.

Para detalhes do calculo de impacto, ver:
[app/domain/costs/README.md](../costs/README.md)

## Rollback e edicao

### Rollback de lote

- `rollbackStockMovementImportBatch` tenta reverter as alteracoes aplicadas do lote inteiro.
- o rollback e conservador: so reverte quando o custo atual ainda aponta para a referencia daquela importacao.
- se o item foi alterado depois, a alteracao entra em conflito e nao sobrescreve o custo atual.

### Rollback de linha

- `rollbackStockMovementImportBatchLine` reverte a linha individual a partir da tela de movimentacoes.
- a movimentacao vinculada e eliminada para liberar nova classificacao/importacao da origem.

### Edicao da linha de origem

- `updateStockMovementImportBatchLineEditableFields` permite corrigir a origem importada.
- a edicao e feita hoje pela tela `admin.stock-movements`.
- a linha e reclassificada depois da alteracao.
- a trilha de auditoria da origem e preservada via vinculo entre lote, linha e movimentacao.

## Retentativa e deduplicacao

### Retentativa

- `retryStockMovementImportBatchErrors` permite retentar uma linha com erro ou todos os erros do lote.
- isso evita recriar o lote em falhas corrigiveis.

### Deduplicacao

O sistema deduplica em dois niveis:

- duplicidade dentro do proprio lote;
- duplicidade contra linhas ja importadas e ainda ativas em lotes anteriores.

Regras atuais:

- a protecao principal e o `sourceFingerprint`;
- linhas ja revertidas deixam de bloquear reaplicacoes futuras.

## Superficies administrativas

### Criacao do lote

- `admin.import-stock-movements.new`
  Upload do `.xlsx` e, opcionalmente, do `.json` de fornecedores.
- `admin.mobile.entrada-estoque-foto`
  Outlet pai com navegacao entre os dois modos de entrada por foto/cupom (tabs "1 cupom" / "Multiplos cupons").
- `admin.mobile.entrada-estoque-foto.unica`
  Modo cupom unico: o usuario seleciona o fornecedor manualmente, o prompt e personalizado com nome e CNPJ do fornecedor selecionado, e o import gera um unico lote.
- `admin.mobile.entrada-estoque-foto.multipla`
  Modo multiplos cupons: sem selecao de fornecedor. O prompt instrui o ChatGPT a ler o nome e CNPJ diretamente de cada cupom e inclui `supplierName`/`supplierCnpj` por linha. O import agrupa as linhas por `supplierName` e cria um lote separado para cada fornecedor. O resultado exibe links diretos para cada lote criado.

### Detalhe do lote

- `admin.import-stock-movements.$batchId`
  Resumo do lote, importacao, rollback, retry, arquivamento, exclusao e acesso aos atalhos operacionais.
- `admin.import-stock-movements.$batchId._index`
  Tabela principal das linhas, com mapeamento de item, conversao manual, ignore/unignore e retry de erro.
- `admin.import-stock-movements.$batchId.applied-changes`
  Tabela de alteracoes aplicadas com comparacao de custo e status de rollback.
- `admin.mobile.import-stock-movements.$batchId`
  Superficie mobile para o mesmo lote, priorizando conciliacao, mapeamento e conversao no celular.

### Conciliacao de fornecedor

- `admin.supplier-reconciliation`
  Tela dedicada para conciliar fornecedores do lote.
- `admin.mobile.import-stock-movements.$batchId.supplier-reconciliation`
  Variante mobile da conciliacao.

### Consultas globais

- `admin.stock-movements`
  Lista das movimentacoes geradas, com filtro por `movementId` e `lineId`, rollback de linha e edicao da origem.
- `admin.global-cost-history`
  Historico global das alteracoes de custo disparadas pela importacao.
- `admin.cost-impact`
  Dashboard de impacto de custo em tempo real.

## Decisoes de arquitetura

- conciliacao de fornecedor faz parte do dominio do import, nao de uma etapa externa invisivel;
- `ready` sozinho nao basta para importar, o lote depende de `readyToImport`;
- a importacao continua incremental via HTTP polling, sem worker dedicado;
- rollback e conservador e respeita a referencia de custo atual;
- a correcao da origem acontece sobre a linha importada, preservando a rastreabilidade;
- impacto de custo downstream e calculado em tempo real no dashboard, sem jobs assincronos.

## Limitacoes conhecidas

- `pending_supplier` ainda e derivado; nao existe como status persistido proprio da linha;
- a edicao detalhada da origem continua centralizada em `admin.stock-movements`, nao no detalhe principal do lote;
- a importacao incremental depende da pagina aberta e do polling do browser;
- ainda faltam testes mais densos para conflitos de rollback, retries, dedupe e cenarios do fluxo de foto.

## Fluxo de foto/cupom via ChatGPT

### Logica compartilhada

Toda a logica de parse, normalizacao e construcao de prompt esta centralizada em dois arquivos no dominio:

- `app/domain/stock-movement/stock-photo-chatgpt.ts`
  Exporta: `parseVisionResponse`, `buildStockPhotoPrompt`, `buildMultiStockPhotoPrompt`, `groupLinesBySupplier`, helpers `str`, `parseNumeric`, `normalizeUnit`, `parseFlexibleDate`, `formatDateInputValue`.

- `app/domain/stock-movement/stock-photo-chatgpt-settings.ts`
  Exporta os templates de prompt e as constantes de configuracao para busca no banco (`Setting`).
  - `DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE` — prompt para cupom unico, com `{{supplierName}}`, `{{supplierCnpj}}` e `{{returnUrl}}`.
  - `DEFAULT_STOCK_PHOTO_MULTI_CHATGPT_PROMPT_TEMPLATE` — prompt para multiplos cupons, sem fornecedor fixo. Instrui o ChatGPT a ler o nome e CNPJ de cada cupom individualmente. Usa so `{{returnUrl}}`.

### Como o ChatGPT resolve o fornecedor no modo multiplo

Cada cupom fiscal imprime o nome e CNPJ do emitente no cabecalho. O prompt multi instrui o modelo a ler esses dados diretamente de cada cupom e preencher `supplierName` e `supplierCnpj` por linha. Nao e preciso informar o fornecedor de antemao.

Casos suportados:
- N fotos, cada uma de um fornecedor diferente.
- N fotos com mais de um cupom do mesmo fornecedor — as linhas sao agrupadas pelo `supplierName` lido e viram um unico lote para aquele fornecedor.

### Agrupamento e criacao de lotes

A funcao `groupLinesBySupplier` recebe todas as linhas normalizadas e retorna um array de `SupplierGroup`, cada um com `supplierName`, `supplierCnpj`, `invoiceNumber`, `movementAt` e `lines`. O action de import itera sobre os grupos e chama `createStockMovementImportBatchFromVisionPayload` para cada um.

## Arquivos principais

- `app/domain/stock-movement/stock-movement-import.server.ts`
- `app/domain/stock-movement/stock-photo-chatgpt.ts`
- `app/domain/stock-movement/stock-photo-chatgpt-settings.ts`
- `app/routes/admin.import-stock-movements.new.tsx`
- `app/routes/admin.import-stock-movements.$batchId.tsx`
- `app/routes/admin.import-stock-movements.$batchId._index.tsx`
- `app/routes/admin.import-stock-movements.$batchId.applied-changes.tsx`
- `app/routes/admin.mobile.entrada-estoque-foto.tsx`
- `app/routes/admin.mobile.entrada-estoque-foto._index.tsx`
- `app/routes/admin.mobile.entrada-estoque-foto.unica.tsx`
- `app/routes/admin.mobile.entrada-estoque-foto.multipla.tsx`
- `app/routes/admin.mobile.import-stock-movements.$batchId.tsx`
- `app/routes/admin.supplier-reconciliation.tsx`
- `app/routes/admin.mobile.import-stock-movements.$batchId.supplier-reconciliation.tsx`
- `app/routes/api.admin-stock-import-batch-import-step.tsx`
- `app/routes/admin.stock-movements.tsx`
- `app/routes/admin.global-cost-history.tsx`
