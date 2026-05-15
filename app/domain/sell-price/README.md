# Politica de preco de venda

Este documento consolida a politica atual de preco de venda no fluxo nativo de
`Item`. Ele deve ser o ponto de partida para alteracoes em precificacao,
simulacao de combos, revisao de margem e matriz de precos por canal.

## Escopo

A politica aqui cobre o fluxo atual baseado em:

- `Item`
- `ItemVariation`
- `ItemSellingInfo`
- `ItemSellingChannelItem`
- `ItemSellingPriceVariation`
- `ItemCostSheet`

Modelos `MenuItem*` ainda existem em partes legadas do sistema, mas nao devem
ser usados como fonte de verdade para novas regras de precificacao.

## Fonte de verdade

### Identidade comercial

- `Item` e a raiz do produto vendavel.
- `ItemVariation` e a unidade real de preco e custo.
- Um item pode ter varias variacoes; a variacao de referencia fica marcada em
  `ItemVariation.isReference`.

### Canal de venda

- `ItemSellingChannel` define configuracoes comerciais do canal, como
  `targetMarginPerc`, `taxPerc`, `feeAmount`, `onlinePaymentTaxPerc` e
  `isMarketplace`.
- `ItemSellingChannelItem` vincula um item a um canal.
- `ItemSellingChannelItem.visible` controla se aquele item pode aparecer naquele
  canal.

### Preco salvo

`ItemSellingPriceVariation` armazena o preco de uma variacao em um canal:

- `itemId`
- `itemVariationId`
- `itemSellingChannelId`
- `priceAmount`
- `priceExpectedAmount`
- `profitExpectedPerc`
- `discountPercentage`
- `previousPriceAmount`

O schema atual nao possui `published` ou `publishedAt` em
`ItemSellingPriceVariation`. Portanto, codigo novo nao deve depender desses
campos.

## Custo usado na precificacao

Para produtos vendaveis, o custo operacional da precificacao deve vir da
`ItemCostSheet` ativa da combinacao `Item + ItemVariation`.

Regra:

- a ficha tecnica ativa e a fonte operacional do custo de venda;
- `Recipe` pode participar da composicao tecnica, mas nao e a fonte final do
  custo comercial;
- se uma tela precisar de fallback, pode usar o custo corrente da variacao, mas
  deve sinalizar que nao esta usando ficha ativa;
- a ficha ja deve conter os custos especificos de venda do sistema, como massa,
  embalagem, mao de obra, ajustes e perda final quando aplicavel.

No fluxo nativo atual, `computeNativeItemSellingPriceBreakdown` trata
`ItemCostSheet.costAmount` como custo completo. Por isso, ele nao soma massa ou
embalagem novamente.

## Formula principal

O preco recomendado com lucro usa:

```txt
precoComLucro = custo / (1 - (dnaPerc + margemAlvoPerc))
```

Onde:

- `custo` vem da ficha ativa da variacao;
- `dnaPerc` vem de `DnaEmpresaSettings.dnaPerc`, pelo registro atual
  `isSnapshot = false`;
- `margemAlvoPerc` vem de `ItemSellingChannel.targetMarginPerc`.

O preco de equilibrio usa a mesma base, mas sem margem alvo:

```txt
precoEquilibrio = custo / (1 - dnaPerc)
```

O calculo arredonda o resultado para cima em passos de `0.05`.

## Marketplace

Quando `ItemSellingChannel.isMarketplace = true`, o sistema calcula primeiro o
preco base com DNA e margem alvo. Depois aplica a taxa percentual do canal:

```txt
precoMarketplace = precoBase / (1 - taxaCanalPerc)
```

Hoje `otherCosts` e tratado como `0` nesse passo. `taxPerc` entra apenas para
canais marketplace nesse calculo.

## Lucro real do preco salvo

Para avaliar um preco ja salvo em `ItemSellingPriceVariation.priceAmount`, o
sistema calcula:

```txt
dnaAmount = priceAmount * dnaPerc
channelTaxAmount = isMarketplace ? priceAmount * taxPerc : 0
operationalCost = custoBase + dnaAmount + channelTaxAmount
profitAmount = priceAmount - operationalCost
profitPerc = profitAmount / priceAmount
```

O `custoBase` considera os campos do breakdown:

- `custoFichaTecnica`
- `wasteCost`
- `packagingCostAmount`
- `doughCostAmount`

No fluxo nativo atual, `wasteCost`, `packagingCostAmount` e
`doughCostAmount` ficam zerados porque a ficha ativa ja concentra o custo
comercial completo.

## Campos salvos na matriz de precos

Ao salvar um preco nativo, o sistema grava:

- `priceAmount`: preco informado/salvo pelo operador;
- `previousPriceAmount`: preco anterior, quando havia linha existente;
- `priceExpectedAmount`: preco recomendado calculado naquele momento;
- `profitExpectedPerc`: margem alvo do canal naquele momento;
- `discountPercentage`: reservado para desconto;
- `updatedBy`: operador quando disponivel.

`priceExpectedAmount` e `profitExpectedPerc` sao snapshots de apoio para
auditoria e comparacao. A margem real atual deve ser recalculada em runtime
quando a tela estiver analisando custo, DNA ou taxas atuais.

## Elegibilidade comercial

Um item so deve entrar em simulacoes comerciais ou superficies publicas quando
for realmente vendavel no canal avaliado.

Regra base:

```txt
canSell && active && channel.visible && !upcoming && hasPriceForChannel
```

Detalhes:

- `Item.canSell = true`
- `Item.active = true`
- existe vinculo em `ItemSellingChannelItem` para o canal;
- `ItemSellingChannelItem.visible = true`
- `ItemSellingInfo.upcoming = false`
- existe preco em `ItemSellingPriceVariation` para a variacao e canal.

Para o cardapio publico, use a regra especifica da fonte publica em
`app/domain/cardapio/cardapio-items-source.server.ts`.

## Rotas e modulos principais

- `app/domain/item/item-selling-price-calculation.server.ts`
  - calcula o breakdown nativo e monta o payload de upsert;
- `app/domain/item/item-selling-price-review.ts`
  - calcula lucro real, preco recomendado, gap de margem e status de revisao;
- `app/domain/item/item-selling-price-variation.entity.server.ts`
  - persiste os precos nativos por variacao e canal;
- `app/routes/admin.vendas.sell-price-management.faixas-lucro.tsx`
  - mostra faixas de lucro recalculadas;
- `app/routes/admin.vendas.sell-price-management.precos-por-canal.tsx`
  - revisa precos por canal;
- `app/routes/admin.vendas.sell-price-management.revisao-precos.tsx`
  - lista precos que precisam de revisao;
- `app/routes/admin.items.$id.venda.precos.tsx`
  - boundary de acao das telas de preco de um item.

## Relacao com o gerador de combos

O gerador de combos deve consumir esta politica, nao criar uma segunda regra.

Para simulacao:

- identidade e variacoes devem vir do fluxo nativo de `Item`;
- preco individual deve vir de `ItemSellingPriceVariation` no canal selecionado;
- custo deve vir da ficha ativa da variacao, com fallback sinalizado quando
  necessario;
- margem alvo default pode vir do canal, mas a simulacao pode permitir ajuste
  manual;
- desconto equivalente deve ser calculado contra a soma dos precos individuais.

Se no futuro o combo virar persistente, a decisao de modelagem deve ser
explicita: combo como novo `Item` vendavel ou combo como regra promocional.

## Documentos relacionados

- `app/domain/item/README.md`
- `app/domain/costs/README.md`
- `app/domain/cardapio/item-cost-sheet/README.md`
- `app/domain/sell-price/README-combo-generator.md`
