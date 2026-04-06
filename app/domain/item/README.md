# Domínio Item

Este documento descreve as regras de negócio associadas aos flags de operação do `Item`.

## Flags de operação (regra simples)

- `canPurchase`: o item pode ser comprado/abastecido (fluxos de compra e importação de NF).
- `canTransform`: o item pode participar de transformação/produção (receitas/fichas técnicas).
- `canSell`: o item pode ser vendido.
- `canStock`: o item controla estoque.
- `canSell` **controla a disponibilidade no cardápio** (derivado).
  - O campo `canBeInMenu` não existe mais; use `canSell` como fonte única.

## Observações práticas

- Evite combinações incoerentes (ex.: item vendável sem custo definido).
- Para custos, `canTransform` tende a indicar custo vindo de receita/ficha técnica; `canPurchase` tende a indicar custo vindo de compra.

## Cardápio via `items` — regra atual de visibilidade

No fluxo nativo do cardápio baseado em `Item`, a visibilidade pública nao depende mais de `ItemSellingInfo.visible`.

Para um item aparecer no cardápio do canal `cardapio`, as condicoes atuais sao:

- `item.canSell = true`
- `item.active = true`
- existe vinculo em `ItemSellingChannelItem` para o canal `cardapio`
- `ItemSellingChannelItem.visible = true` nesse vinculo
- `ItemSellingInfo.upcoming = false`
- existe pelo menos um `ItemSellingPriceVariation` do canal `cardapio` com `published = true`

Formula pratica:

- `canSell && active && channel(cardapio).visible && !upcoming && hasPublishedPrice(cardapio)`

Separacao de responsabilidades:

- `ItemSellingChannelItem`: representa o vinculo do item com um canal e controla a visibilidade publica por canal.
- `ItemSellingPriceVariation.published`: controla quais precos daquele canal estao publicados.
- `ItemSellingInfo`: concentra dados comerciais gerais como `slug`, `ingredients`, `longDescription`, `notesPublic` e `upcoming`.

Observacao:

- Vincular o item ao canal nao implica exposicao publica imediata. O item pode estar vinculado ao canal, ter precos cadastrados e continuar oculto enquanto `ItemSellingChannelItem.visible = false`.

---

## Histórico de custos — `ItemCostVariationHistory`

Cada vez que o custo de uma variação de item muda, um registro é inserido em `ItemCostVariationHistory`. Os campos `source` e `referenceType` identificam a origem do evento.

### Origens possíveis (`source` × `referenceType`)

| `referenceType` | `source` | Quando é criado | `referenceId` aponta para |
|---|---|---|---|
| `stock-movement` | `import` | Import de lote aplicado — caminho normal | `StockMovement.id` |
| `stock-movement` | `adjustment` | Edição de linha com movimento ativo | `StockMovement.id` |
| `stock-movement-delete` | `import` | Reversão de um movimento de importação | `StockMovement.id` do movimento removido |
| `stock-movement` | `manual` | Registro manual via aba Custos ou mobile levantamento-custo-item | `StockMovement.id` |
| `stock-movement` | `item-cost-sheet` | Snapshot de ficha de custo publicado como evento canônico | `StockMovement.id` |

> **Dados legados:** Registros anteriores podem conter `referenceType = "stock-movement-import-line"` (import sem movimento associado, padrão removido), `source = "purchase"` ou nenhum valor. O código de leitura ainda reconhece esses casos para manter compatibilidade com histórico existente, mas eles não fazem parte do modelo canônico atual.

### Regras de normalização de custo

O campo `unit` gravado no histórico determina como o valor é convertido para a unidade de consumo (`consumptionUm`) pela função `normalizeItemCostToConsumptionUnit`:

1. Se `consumptionUm` não está definido no item → retorna o valor bruto (sem conversão).
2. Se `source = "item-cost-sheet"` e `unit` é vazio → assume que o valor já está normalizado (atalho).
3. Se `unit === consumptionUm` → retorna o valor bruto (já na unidade certa).
4. Se `unit` tem correspondência em `ItemPurchaseConversion` → divide pelo fator registrado.
5. Fallback legado: se `unit === purchaseUm` e `purchaseToConsumptionFactor` está definido → divide pelo fator.
6. Caso contrário → retorna `null` (não normalizável).

### Pontos de atenção

- **Entradas manuais** (`referenceType = null`) não têm rastreabilidade para movimentos de estoque. O valor é gravado na unidade que o usuário selecionou, sem conversão automática. Se o usuário selecionou uma unidade de compra (ex.: "CX") e não há conversão configurada, o custo ficará com unidade incompatível.
- **`source = "item-cost-sheet"`** agora também nasce de `StockMovement` canônico, mas continua usando `unit` vazio como atalho de valor já normalizado.
- **Entradas via import** (`referenceType = "stock-movement"`) têm rastreabilidade completa: o `referenceId` aponta para o `StockMovement` original que contém `conversionFactorUsed`, `movementUnit` e `newCostUnit`.
- Para o dashboard de variação de custos, apenas pares de entradas onde **ambas** normalizam com sucesso são exibidos. Pares onde a normalização de uma das entradas retorna `null` são descartados silenciosamente (não há dado suficiente para comparação válida).
