# Domínio Item

Este documento descreve a modelagem canônica do domínio `Item` e foi escrito para ser útil tanto para pessoas quanto para assistentes de AI que precisem responder perguntas, implementar mudanças ou depurar fluxos relacionados.

## Resumo executivo

- `Item` é a entidade raiz do catálogo operacional.
- O sistema não deve mais tratar `MenuItem` como fonte de verdade para produto vendável.
- A disponibilidade pública no cardápio é derivada de flags e vínculos de venda; não existe mais `canBeInMenu`.
- Custos são controlados por `ItemVariation`, com separação entre:
  - estado atual: `ItemCostVariation`
  - histórico/auditoria operacional: `ItemCostVariationHistory`
- Cada `Item` deve ter pelo menos uma variação ativa. O código garante a variação base automaticamente no create.

## Como pensar o domínio

Use esta hierarquia mental:

1. `Item`
2. `ItemVariation`
3. venda por canal e por variação
4. custo atual e histórico por variação

Em outras palavras:

- `Item` responde "o que é esse recurso no catálogo?"
- `ItemVariation` responde "qual recorte vendável/técnico desse item?"
- `ItemSellingInfo`, `ItemSellingChannelItem` e `ItemSellingPriceVariation` respondem "como esse item é publicado e precificado?"
- `ItemCostVariation` e `ItemCostVariationHistory` respondem "qual é o custo atual e como ele evoluiu?"

## Entidades canônicas

### `Item`

Campos centrais:

- `classification`: `insumo | semi_acabado | produto_final | embalagem | servico | outro`
- `recipeVariationPolicy`: `auto | hide | show`
- `purchaseUm`, `consumptionUm`, `purchaseToConsumptionFactor`
- `active`
- `canPurchase`, `canTransform`, `canSell`, `canStock`

Responsabilidades:

- identificar o item base do sistema;
- concentrar flags operacionais;
- servir de raiz para custo, venda, estoque, imagens, tags e engajamento.

### `ItemVariation`

Representa o vínculo entre um `Item` e uma `Variation`.

Campos centrais:

- `itemId`
- `variationId`
- `isReference`
- `recipeId`
- `deletedAt`

Regras:

- um item pode ter várias variações ativas;
- no máximo uma variação ativa deve ser `isReference = true`;
- ao criar um `Item`, o código chama `ensureBaseVariationForItem`, então a variação base deve existir mesmo quando o usuário não escolhe manualmente nenhuma variação;
- ao remover/restaurar/substituir variações, o código reequilibra automaticamente a referência.

### `ItemSellingInfo`

Concentra metadados comerciais gerais do item:

- `ingredients`
- `longDescription`
- `categoryId` de cardápio
- `itemGroupId`
- `notesPublic`
- `slug`
- `upcoming`

Importante:

- `ItemSellingInfo` não controla sozinha a exposição pública;
- `upcoming = true` bloqueia a visibilidade pública do item no fluxo nativo.

### `ItemSellingChannelItem`

Representa o vínculo do item com um canal de venda.

Campos centrais:

- `itemId`
- `itemSellingChannelId`
- `visible`

Papel:

- habilitar o item para um canal;
- controlar a visibilidade pública por canal.

Observação:

- vincular o item a um canal não implica publicação automática.

### `ItemSellingPriceVariation`

Preço por `ItemVariation` em um canal específico.

Campos centrais:

- `itemId`
- `itemVariationId`
- `itemSellingChannelId`
- `priceAmount`
- `published`
- `publishedAt`

Papel:

- armazenar o preço da variação naquele canal;
- indicar quais preços estão publicados.

### `ItemCostVariation`

Snapshot do custo atual da variação.

Campos centrais:

- `itemVariationId`
- `costAmount`
- `previousCostAmount`
- `unit`
- `source`
- `referenceType`
- `referenceId`
- `validFrom`

### `ItemCostVariationHistory`

Histórico canônico dos eventos de custo da variação.

Campos centrais:

- `itemVariationId`
- `costAmount`
- `previousCostAmount`
- `unit`
- `source`
- `referenceType`
- `referenceId`
- `validFrom`
- `metadata`

Uso esperado:

- responder auditoria;
- reconstruir evolução de custo;
- alimentar dashboards e análises de impacto.

## Invariantes importantes

- `Item` é a fonte de verdade do produto no fluxo novo.
- `MenuItem` ainda existe como compat layer em partes do sistema, mas não deve ser tratado como modelo canônico para novos fluxos.
- `canSell` substitui `canBeInMenu`; o campo antigo não existe mais.
- todo `Item` novo deve terminar com uma variação base ativa;
- uma única variação ativa deve ser a referência operacional do item;
- custo atual e histórico são conceitos diferentes e não devem ser confundidos;
- publicação por canal depende de vínculo de canal + preço publicado + flags comerciais.

## Flags operacionais do item

- `canPurchase`: item pode participar de compra/abastecimento/importação.
- `canTransform`: item pode entrar em transformação/produção/receita/ficha de custo.
- `canSell`: item pode ser vendido.
- `canStock`: item movimenta e mantém estado de estoque.
- `active`: item está operacional no sistema.

Heurísticas úteis:

- `produto_final` tende a usar `canSell = true`;
- `insumo` tende a usar `canPurchase = true`;
- `semi_acabado` costuma participar de receita e custo intermediário;
- o sistema não impede toda combinação incoerente de flags, então código e suporte devem validar o contexto de uso.

## Regra atual de visibilidade no cardápio

No fluxo nativo baseado em `Item`, a visibilidade pública do canal `cardapio` é derivada desta regra:

- `item.canSell = true`
- `item.active = true`
- existe vínculo em `ItemSellingChannelItem` para o canal `cardapio`
- `ItemSellingChannelItem.visible = true`
- `ItemSellingInfo.upcoming = false`
- existe ao menos um `ItemSellingPriceVariation` publicado para canal habilitado

Fórmula prática:

- `canSell && active && channel(cardapio).visible && !upcoming && hasPublishedPrice(cardapio)`

Separação de responsabilidades:

- `ItemSellingChannelItem.visible` responde "o item pode aparecer nesse canal?"
- `ItemSellingPriceVariation.published` responde "esta variação/preço está publicada?"
- `ItemSellingInfo.upcoming` responde "o item está bloqueado por lançamento futuro?"

Consequência operacional:

- um item pode estar vinculado ao canal e ter preço salvo, mas continuar fora do cardápio público.

## Custos: modelo mental correto

### Estado atual x histórico

Ao alterar custo de uma variação:

- `ItemCostVariation` guarda o estado atual da variação;
- `ItemCostVariationHistory` registra o evento histórico correspondente.

Isso significa:

- não use a tabela de histórico como snapshot atual;
- não use a tabela atual como trilha completa de auditoria.

### Regras de escrita no histórico

O método `setCurrentCost` tem duas políticas diferentes:

- se `referenceType = "stock-movement"` e existe `referenceId`, o histórico é atualizado em-place para manter 1 registro por movimento real;
- nos demais casos, uma nova linha é sempre adicionada ao histórico.

Consequência:

- eventos de movimento de estoque são idempotentes no histórico;
- entradas manuais, ajustes sem vínculo e deleções geram append-only.

### Origens canônicas de custo

Hoje a lista canônica de `source` acompanha `app/domain/costs/item-cost-sources.ts`:

- `manual`
- `import`
- `adjustment`
- `item-cost-sheet`

Registros antigos ainda podem conter valores legados como `purchase` ou tipos antigos de referência. O código de leitura preserva compatibilidade, mas novos fluxos não devem gerar esses formatos.

### Matriz `source` x `referenceType`

| `referenceType` | `source` | Quando é criado | `referenceId` aponta para |
|---|---|---|---|
| `stock-movement` | `import` | import de lote aplicado | `StockMovement.id` |
| `stock-movement` | `adjustment` | edição de linha com movimento ativo | `StockMovement.id` |
| `stock-movement-delete` | `import` | reversão de movimento importado | `StockMovement.id` removido |
| `stock-movement` | `manual` | registro manual que gerou movimento canônico | `StockMovement.id` |
| `stock-movement` | `item-cost-sheet` | snapshot de ficha publicado como evento canônico | `StockMovement.id` |

## Normalização de custo por unidade

`ItemCostVariationHistory.unit` precisa ser interpretado junto de `Item.consumptionUm`.

Regras atuais:

1. sem `consumptionUm`, o valor bruto é usado;
2. se `source = "item-cost-sheet"` e `unit` vier vazio, o valor já é tratado como normalizado;
3. se `unit === consumptionUm`, nenhuma conversão é necessária;
4. se houver `ItemPurchaseConversion` compatível, o valor é dividido pelo fator registrado;
5. fallback legado: se `unit === purchaseUm` e existir `purchaseToConsumptionFactor`, divide por esse fator;
6. se nada disso resolver, o valor não é normalizável.

Pontos de atenção:

- custo manual com unidade incompatível pode inviabilizar comparação histórica;
- dashboards de variação descartam silenciosamente pares que não conseguem ser normalizados;
- `item-cost-sheet` usa `unit` vazio como atalho semântico, não como ausência acidental de dado.

## Receita, ficha e item

Relações principais:

- `Recipe` representa composição técnica;
- `ItemCostSheet` representa aplicação comercial/operacional do custo por item + variação;
- `ItemVariation.recipeId` pode vincular uma variação a uma receita principal;
- `recipeVariationPolicy` controla como a UI trata variações no contexto de receita.

Regra de leitura:

- se a pergunta for sobre "custo do item vendido", comece por `ItemCostSheet` e `ItemCostVariation`;
- se a pergunta for sobre "composição técnica", comece por `Recipe` e ingredientes;
- se a pergunta misturar ambos, trate `Recipe` como origem técnica e `ItemCostSheet` como aplicação comercial.

## Estoque e importação

`StockMovement` é a entidade canônica de movimentação usada para rastrear eventos reais de custo/estoque.

Campos especialmente relevantes:

- `movementType`
- `itemId`
- `itemVariationId`
- `newCostAmount`
- `newCostUnit`
- `movementUnit`
- `conversionFactorUsed`
- `originType`
- `originRefId`

Quando existir `referenceType = "stock-movement"` no custo:

- a trilha principal deve ser seguida por `referenceId -> StockMovement.id`.

## Compatibilidade legada

Camadas legadas ainda presentes:

- `MenuItem`
- projeções e bridges ligadas a cardápio antigo
- alguns fluxos de exportação/consulta que ainda expõem shape compatível de `MenuItem`

Regra prática:

- para novas decisões de domínio, prefira sempre `Item`;
- use `MenuItem` apenas quando estiver lidando com compatibilidade, exportação antiga ou telas ainda não migradas.

## Perguntas comuns e resposta correta

### "O item aparece no cardápio?"

Não basta olhar um único campo. Verifique:

- `item.canSell`
- `item.active`
- vínculo em `ItemSellingChannelItem` para `cardapio`
- `ItemSellingChannelItem.visible`
- `ItemSellingInfo.upcoming`
- existência de `ItemSellingPriceVariation.published = true`

### "Qual é o custo atual do item?"

Não leia diretamente `Item`. Descubra:

1. a `ItemVariation` relevante;
2. o `ItemCostVariation` dessa variação.

### "Qual é o histórico do custo?"

Use `ItemCostVariationHistory`, preferindo ordenar por:

- `validFrom desc`
- `createdAt desc`

### "O item tem variações?"

Use `ItemVariation` com `deletedAt = null`. Não assuma que a primeira é a referência; prefira `isReference = true`.

### "O item acabou de ser criado. Ele já tem variação?"

Sim, deveria ter. O create chama `ensureBaseVariationForItem`.

## Guia para assistentes de AI

Ao responder ou alterar código deste domínio, siga estas prioridades:

- trate `Item` como fonte de verdade;
- trate `ItemVariation` como unidade real de custo e preço;
- diferencie "vínculo no canal", "preço publicado" e "visibilidade pública";
- diferencie "estado atual do custo" de "histórico do custo";
- se encontrar `MenuItem`, pergunte primeiro se aquilo é compatibilidade legada ou ainda parte do fluxo canônico.

Evite estas conclusões erradas:

- "se existe `ItemSellingInfo`, então o item está público";
- "se existe preço, então o item está publicado";
- "se existe histórico, o último histórico é sempre o snapshot atual";
- "qualquer item novo pode nascer sem variação".

### Ordem sugerida de leitura no código

Para entender comportamento atual do domínio, comece por:

- `prisma/schema.prisma`
- `app/domain/item/item.prisma.entity.server.ts`
- `app/domain/item/item-variation.prisma.entity.server.ts`
- `app/domain/item/item-cost-variation.prisma.entity.server.ts`
- `app/domain/item/item-selling-overview.server.ts`
- `app/domain/cardapio/cardapio-items-source.server.ts`

### Perguntas de diagnóstico úteis

Quando estiver depurando, pergunte:

- qual `itemId` está em jogo?
- qual `itemVariationId` está em jogo?
- o item está ativo?
- `canSell` está ligado?
- existe vínculo com o canal certo?
- esse vínculo está `visible = true`?
- existe preço publicado nesse canal?
- o item está marcado como `upcoming`?
- o custo que estou vendo é snapshot atual ou histórico?
- o evento de custo tem `referenceId` rastreável para `StockMovement`?

## Limites deste documento

Este README descreve a regra de negócio e os pontos de decisão principais do domínio `Item`. Para detalhes específicos de:

- custo em cascata e impactos: veja `app/domain/costs/README.md`
- fichas de custo: veja `app/domain/cardapio/item-cost-sheet/README.md`
- movimentação de estoque/importação: veja `app/domain/stock-movement/README.md`
