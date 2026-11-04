# Ordens de Produção (panificação)

Módulo de OP: "produzir esta receita usando X do ingrediente-base". Fase 1, sem estoque, custos, perdas ou rastreabilidade.

## Conceitos

- **Ingrediente-base**: `Recipe.productionBaseRecipeIngredientId` (id de `RecipeIngredient`, sem FK). Define o dimensionamento. Não é fixo em farinha.
- **Preparação intermediária** (biga, poolish, tangzhong, autólise...): `RecipePreparation` + `RecipePreparationIngredient`. Quantidade de cada linha fica na mesma unidade da linha da receita (variação de referência). Sem limite de preparações por receita.
- **Etapa final**: total escalado − soma de todas as preparações. Nunca duplica ingrediente.
- **Inconsistência**: se a soma das preparações passa do total de algum ingrediente, `plan.inconsistencies` é preenchido. A criação da OP e o salvamento da configuração são bloqueados.
- Receita sem preparação gera só a etapa "Mistura final".

## Modelos (prisma/schema.prisma, migration `20261102000000_production_orders`)

- `ProductionOrder`: `number` autoincrement, snapshot em `plan` (JSON), status `planned | in_progress | finished | cancelled`, datas de início e fim, `producedQuantity`/`producedUnit` opcionais.
- `ProductionOrderStep`: `kind` `preparation | final`, status `pending | in_progress | done`.
- A OP guarda snapshot. Alterar a receita depois não muda OPs existentes.

## Arquivos

- `production-order-calc.ts`: cálculo puro (`calculateProductionPlan`), conversão g/kg e ml/L, formatação ("500 g", "2,5 kg"). Testes em `production-order-calc.test.ts`. Reusa `calculateRecipeScaleFromIngredient` de `~/domain/recipe/recipe-scaling`.
- `production-order.server.ts`: leitura da receita (via `getMobileRecipe`), salvar configuração, criar OP, listar, ações (`start`, `step`, `finish`, `cancel`) e regras de transição.
- `components/production-ui.tsx`: badge de status, `Quantity`, `IngredientList`, cores por preparação.
- `daily-programming.server.ts`: módulo anterior de programação diária, sem relação com este.

## Rotas

- `app/routes/admin.producao.ordens._index.tsx`: lista (usa `defer` + `Await`).
- `app/routes/admin.producao.ordens.new.tsx`: nova OP com prévia ao vivo via GET.
- `app/routes/admin.producao.ordens.$id.tsx`: painel operacional em 3 colunas.
- `app/routes/admin.producao.receitas.$recipeId.tsx`: ingrediente-base e preparações da receita.
- Menu: item "Ordens de Produção" em `website-navigation/links/admin-navigation.ts`.

## Regras de fluxo

- Etapas só podem ser operadas com a OP em produção.
- "Mistura final" fica bloqueada até todas as preparações estarem concluídas.
- Finalizar exige todas as etapas concluídas.
- Reabrir preparação exige a mistura final pendente.

## UI

Pensada para monitor touch de 27"+: botões e inputs grandes (h-14 a h-24), números em destaque, cards grandes. Segue em landscape com 3 colunas a partir de `xl` e empilha em telas menores. Usa o `Select` do shadcn, nunca `<select>` nativo.

## Limitações conhecidas

- Usa a variação de referência da receita. Receitas com várias variações não escolhem variação na OP.
- Unidades fora de massa/volume (ex.: UN) não convertem. A quantidade da preparação deve estar na unidade da receita.
- Fora do escopo desta fase: estoque, baixa automática, perdas, custos, rastreabilidade, capacidade, funcionários.
- Rodar `npm run migrate:deploy` antes de usar. O typecheck do repo é lento (minutos).
