# Gerador de combos - analise de dominio

Este documento descreve a linha de raciocinio para uma futura pagina administrativa de geracao de combos no grupo `Vendas`.

O objetivo aqui nao e definir a implementacao final, mas registrar a modelagem, as fontes de verdade e os limites de escopo para que a primeira versao seja pequena, auditavel e alinhada com o fluxo nativo de `Item`.

Para a politica geral de preco de venda, fontes de verdade, formula de DNA,
margem por canal e regra de marketplace, leia primeiro
`app/domain/sell-price/README.md`. Este documento trata somente da ferramenta
de simulacao de combos.

## Decisao principal

A pagina deve nascer como uma ferramenta de simulacao comercial, nao como um novo cadastro persistente.

Rota proposta:

- `/admin/vendas/gerador-combos`
- arquivo Remix: `app/routes/admin.vendas.gerador-combos.tsx`
- menu: `Vendas > Ferramentas > Gerador de combos`

Motivo:

- o combo e uma decisao de venda;
- ele usa preco, margem, ficha tecnica e canal;
- mas nao deve ficar misturado com `Precos de venda`, porque nao edita diretamente a matriz de precos;
- tambem nao deve ficar em `Custos e Margem`, porque a decisao final e comercial.

## Problema que a pagina resolve

Hoje o operador consegue consultar itens, precos e custos em telas separadas. Para montar um combo, porem, ele precisa responder rapidamente:

- quais itens entram no combo;
- qual variacao de cada item sera usada;
- qual canal de venda sera considerado;
- quanto o combo custa;
- quanto o cliente pagaria se comprasse os itens separados;
- qual preco sugerido preserva a margem desejada;
- quanto desconto comercial ainda e aceitavel.

A ferramenta deve transformar essas leituras em uma simulacao unica.

## Fontes de verdade

A pagina deve usar o fluxo nativo de `Item`, nao modelos legados de `MenuItem`.

Identidade comercial:

- `Item`
- `ItemVariation`

Dados comerciais:

- `ItemSellingInfo`
- `ItemSellingChannelItem`
- `ItemSellingPriceVariation`
- canal de venda selecionado

Custo:

- ficha tecnica ativa da variacao, quando existir;
- custo corrente da variacao como fallback operacional;
- nunca recalcular custo por `Recipe` diretamente na tela.

Tags e filtros:

- `ItemTag`
- `Tag`

## Regra de elegibilidade dos itens

A primeira versao deve listar apenas itens que fazem sentido para uma simulacao de venda.

Regra base:

- `Item.canSell = true`
- `Item.active = true`
- existe vinculo no canal selecionado em `ItemSellingChannelItem`
- `ItemSellingChannelItem.visible = true`
- `ItemSellingInfo.upcoming = false`
- existe preco em `ItemSellingPriceVariation` para a variacao e canal selecionados

Essa regra segue a mesma direcao da visibilidade comercial atual: o combo deve ser montado a partir de itens realmente vendaveis no canal escolhido.

## Estrutura da tela

A tela deve ser operacional e densa, parecida com `/admin/vendas/itens-vendidos`.

### 1. Contexto do combo

Campos:

- nome do combo;
- canal de venda;
- margem alvo;
- tipo de simulacao:
  - preco por margem;
  - desconto sobre soma individual;
  - preco manual.

### 2. Selecao de itens

Controles:

- busca por nome, slug ou descricao;
- filtro por tag;
- filtro por categoria, se a consulta ja disponibilizar esse dado sem custo alto;
- seletor de variacao;
- quantidade por item;
- botao de adicionar/remover linha.

Cada linha deve mostrar:

- item;
- variacao;
- preco atual no canal;
- custo da ficha/variacao;
- margem individual estimada;
- quantidade dentro do combo.

### 3. Resultado da simulacao

Indicadores:

- custo total do combo;
- soma dos precos individuais;
- preco sugerido;
- desconto equivalente;
- margem bruta estimada;
- diferenca entre margem alvo e margem simulada.

Acoes iniciais:

- copiar resumo;
- abrir item em nova aba;
- limpar simulacao.

A acao `Criar combo como item` deve ficar fora do MVP ate o modelo de persistencia estar fechado.

## Calculos

### Custo total

Formula:

```txt
custoTotal = soma(custoUnitarioDaVariacao * quantidadeNoCombo)
```

O custo unitario deve vir da melhor fonte financeira disponivel:

1. ficha tecnica ativa da variacao;
2. custo corrente da variacao;
3. vazio/indisponivel, com alerta na linha.

Nao deve buscar custo em `Recipe` para evitar duplicar a regra financeira que ja pertence a ficha tecnica.

### Soma individual

Formula:

```txt
precoIndividualTotal = soma(precoAtualNoCanal * quantidadeNoCombo)
```

Esse valor serve como referencia comercial para desconto.

### Preco sugerido por margem

Formula conceitual simplificada para simulacao:

```txt
precoSugerido = custoTotal / (1 - margemAlvo)
```

Observacoes:

- `margemAlvo` deve ser tratada como percentual decimal no calculo;
- a regra consolidada de DNA, taxas de canal e marketplace esta em
  `app/domain/sell-price/README.md`;
- se o MVP nao aplicar toda a politica de preco, a tela deve deixar isso claro.

### Desconto equivalente

Formula:

```txt
descontoPerc = 1 - (precoCombo / precoIndividualTotal)
```

Se `precoIndividualTotal` for zero ou ausente, o desconto nao deve ser exibido.

## MVP recomendado

A primeira versao deve ser somente simulador.

Inclui:

- rota unica;
- loader buscando canais e itens elegiveis;
- busca e filtro por tag;
- selecao manual de itens e variacoes;
- calculo em memoria no cliente a partir do payload carregado;
- resultado visual com custo, preco sugerido, margem e desconto.

Nao inclui:

- criacao automatica de `Item`;
- persistencia de rascunho;
- publicacao em canal;
- promocao agendada;
- integracao direta com cardapio publico;
- regras complexas de disponibilidade por horario.

Essa divisao reduz o risco de criar uma modelagem errada cedo demais.

## Evolucao para persistencia

Se a ferramenta passar a salvar combos, a modelagem deve ser explicita.

Opcoes:

### Opcao A: combo como `Item`

Criar um `Item` vendavel para representar o combo.

Vantagens:

- usa o fluxo nativo de venda;
- pode ter preco por canal;
- pode aparecer no cardapio como qualquer outro produto;
- reaproveita tags, assets e visibilidade.

Risco:

- precisa representar os componentes do combo em uma relacao propria.

Modelo provavel:

```txt
ItemComboComponent
- id
- comboItemId
- componentItemId
- componentItemVariationId
- quantity
- createdAt
- updatedAt
```

### Opcao B: combo como regra promocional

Salvar o combo como uma regra separada, sem virar `Item`.

Vantagens:

- preserva itens originais;
- pode ser usado como campanha temporaria.

Risco:

- exige motor de promocao;
- pode nao encaixar no cardapio atual;
- complica pedido, estoque e relatorios.

### Recomendacao

Se o combo deve aparecer no cardapio e ser vendido como produto, prefira `Opcao A`.

Se o combo for desconto automatico sobre carrinho, prefira `Opcao B`, mas isso ja e outro dominio: promocao/campanha.

## Servico de dominio sugerido

Quando sair do documento para codigo, a regra deve ficar fora da rota.

Arquivo sugerido:

- `app/domain/sell-price/combo-generator.server.ts`

Responsabilidades:

- listar canais elegiveis;
- listar itens elegiveis por canal;
- montar payload de variacoes com preco e custo;
- calcular indicadores no servidor quando houver persistencia;
- manter a rota como composicao de UI.

Tipos sugeridos:

```ts
type ComboGeneratorItemOption = {
  itemId: string;
  itemName: string;
  itemVariationId: string;
  variationName: string;
  channelId: string;
  priceAmount: number | null;
  costAmount: number | null;
  hasActiveCostSheet: boolean;
  tags: Array<{ id: string; name: string }>;
};

type ComboSimulationLine = {
  itemId: string;
  itemVariationId: string;
  quantity: number;
};

type ComboSimulationResult = {
  costTotal: number;
  individualPriceTotal: number;
  suggestedPrice: number;
  discountPerc: number | null;
  marginPerc: number | null;
};
```

## Perguntas em aberto

Antes de implementar criacao real de combos, precisam ser decididos:

- combo vira um `Item` real ou apenas uma simulacao?
- um combo pode ter variacoes?
- combo pode usar itens de canais diferentes?
- preco do combo sera por canal ou global?
- custo deve congelar no momento da criacao ou sempre recalcular a partir das fichas atuais?
- desconto deve considerar taxas do canal/DNA?
- combo deve impactar estoque como venda dos componentes ou como item proprio?

Para o MVP de simulacao, essas perguntas podem ficar abertas. Para persistencia, nao.

## Decisao operacional atual

Implementar primeiro como simulador em `Vendas > Ferramentas`.

Somente depois de validar o uso real da tela, evoluir para uma destas direcoes:

1. criar `Item` de combo com componentes;
2. criar motor de promocao/campanha;
3. manter apenas como ferramenta de analise comercial.
