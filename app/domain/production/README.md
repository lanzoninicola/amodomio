# Ordens de Produção (panificação)

Módulo de OP: "produzir esta receita usando X do ingrediente-base". Fase 1, sem estoque, custos, perdas ou rastreabilidade.

## Conceitos

- **Ingrediente-base**: `Recipe.productionBaseRecipeIngredientId` (id de `RecipeIngredient`, sem FK). Define o dimensionamento. Não é fixo em farinha.
- **Preparação intermediária** (biga, poolish, tangzhong, autólise...): `RecipePreparation` + `RecipePreparationIngredient`. Quantidade de cada linha fica na mesma unidade da linha da receita (variação de referência). Sem limite de preparações por receita.
- **Etapa final**: total escalado − soma de todas as preparações. Nunca duplica ingrediente.
- **Inconsistência**: se a soma das preparações passa do total de algum ingrediente, `plan.inconsistencies` é preenchido. A criação da OP e o salvamento da configuração são bloqueados.
- Receita sem preparação gera só a etapa "Mistura final".

## Jornada em duas fases (atual)

1. **Fase 1 — criar a OP**: receita → ingrediente-base (escolhido na OP, pré-selecionado com o padrão da receita) → quantidade → data. O sistema calcula só os totais (`calculateProductionTotals`). A OP nasce `planned` com `plan.preparationsDefined = false` e **sem etapas**.
2. **Fase 2 — preparações**: a OP pergunta se há preparações intermediárias. "Não" cria só a "Mistura final". "Sim" monta cada preparação com quantidades **absolutas desta produção** (`applyPreparationsToPlan`). Se a receita tem preparações salvas, elas vêm sugeridas e escaladas (`getPreparationSuggestions`). "Salvar como padrão da receita" grava de volta em escala de receita (`definePreparations(..., { saveToRecipe })`).
3. Só depois disso a OP pode ser iniciada (`start` rejeita `preparationsDefined === false`). Definir/alterar preparações só enquanto `planned`. OPs antigas sem o campo contam como definidas.

Onde fica: `definePreparations` e `getPreparationSuggestions` em `production-order.server.ts`; web em `components/preparations-editor.tsx` (usado em `admin.producao.ordens.$id.tsx`); mobile em `OrderPreparationsStep.tsx` (usado em `ProductionOrderDetail.tsx`); API: intent `define-preparations` e `baseIngredientId` em `preview`/`create`; `GET ?id=` e as mutações devolvem `{ order, suggestions }`.

A tela de configuração da receita (`/admin/producao/receitas/:id`) continua existindo só como edição do padrão, sem link na criação da OP. No mobile, `RecipeProductionEditor.tsx` e `preparation-preview.ts` ficaram sem uso.

## Datas da OP

- `productionDate`: dia em que a OP é produzida (filtro da lista).
- `usageDate` (opcional): dia em que o resultado será usado. Ex.: biga feita hoje para a massa de amanhã. Não pode ser anterior à produção. Vazio = mesmo dia. Migration `20261104000000_production_order_usage_date`.

## Modelos (prisma/schema.prisma, migration `20261102000000_production_orders`)

- `ProductionOrder`: `number` autoincrement, snapshot em `plan` (JSON), status `planned | in_progress | finished | cancelled`, datas de início e fim, `producedQuantity`/`producedUnit` opcionais.
- `ProductionOrderStep`: `kind` `preparation | final`, status `pending | in_progress | done`.
- A OP guarda snapshot. Alterar a receita depois não muda OPs existentes.

## Arquivos

- `shared/production/order-plan.ts` (reexportado em `production-order-calc.ts`): cálculo puro (`calculateProductionPlan`), conversão g/kg e ml/L, formatação ("500 g", "2,5 kg"). Testes em `production-order-calc.test.ts`. Reusa `calculateRecipeScaleFromIngredient` de `~/domain/recipe/recipe-scaling`.
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

Prioridade: operação simples para funcionários com pouca familiaridade com sistemas. Usar linguagem cotidiana, ações claras e poucos controles. O fluxo é escolher receita e quantidade, iniciar a produção e concluir as etapas. Configuração de receita é uma tarefa separada da execução diária.

Pensada para monitor touch de 27"+: botões e inputs grandes (h-14 a h-24), números em destaque, cards grandes. Segue em landscape com 3 colunas a partir de `xl` e empilha em telas menores. Usa o `Select` do shadcn, nunca `<select>` nativo.

## Limitações conhecidas

- Usa a variação de referência da receita. Receitas com várias variações não escolhem variação na OP.
- Unidades fora de massa/volume (ex.: UN) não convertem. A quantidade da preparação deve estar na unidade da receita.
- Fora do escopo desta fase: estoque, baixa automática, perdas, custos, rastreabilidade, capacidade, funcionários.
- A migration precisa estar aplicada antes de usar. Em produção, aplicar somente com autorização explícita. Não executar `tsc`, conforme `AGENTS.md`.

## Garantias de validação

- Configurações inconsistentes são rejeitadas pelo servidor antes de gravar. Quantidades negativas, não finitas e ingredientes removidos são rejeitados.
- Ações da mesma OP usam uma transação com bloqueio da linha da ordem para validar o estado atualizado, inclusive em acessos simultâneos.
- Etapas: `pending → done` direto (ou via `in_progress`), `in_progress → pending` e reabertura `done → pending`. Preparações só reabrem com a mistura final pendente.
- A criação fica bloqueada enquanto a prévia está sendo atualizada. A data padrão segue `America/Sao_Paulo`.

## Tablet (app Expo)

Entrada: **Funcionalidades → Produção**. Visual KDS escuro com amarelo para quantidades e ação principal, cabeçalho compacto, botões grandes e etapas lado a lado no landscape. Em telas menores, o conteúdo empilha sem rolagem horizontal.

- Lista por dia, com produções em aberto e encerradas, atualização automática a cada 6 segundos enquanto o app está ativo.
- Nova produção (fase 1): busca de receitas com teclado touch compartilhado e últimas 5 buscas; "Ingrediente base" abre modal com lista de ingredientes, quantidade e unidade; "Produzir em" e "Usar em" abrem o calendário (`DayPicker.tsx`), com atalhos "Mesmo dia" e "Dia seguinte"; observação e prévia dos totais. A confirmação só habilita após a prévia da entrada atual.
- Preparações (fase 2, `OrderPreparationsStep.tsx`): pergunta Sim/Não. Lista de preparações à esquerda (lixeira em cada uma) e "Mistura final" fixa; à direita, todos os ingredientes da receita já listados, com borda colorida por preparação, quantidade e unidade g/kg/%. Colunas "Nesta preparação", "Total da produção" e saldo da mistura final. Botão de colar ao lado do input. Ingrediente com erro mostra "!" e borda vermelha; o ícone abre modal com a explicação. Motivo do bloqueio aparece em faixa fixa no topo. Botão de calculadora (`Calculator.tsx`, com %, copiar valor via `expo-clipboard`, carregado com `require` tardio para não quebrar APK antigo). Também usado para editar enquanto a OP está `planned` ("Editar preparações", com "Cancelar").
- Execução: etapas à esquerda em telas a partir de 900px e ingredientes à direita; ação principal fixa no rodapé. Etapas reordenáveis por arrastar (`ReorderableList.tsx`, PanResponder), "Mistura final" fixa por último. Cada etapa tem ícones de concluir (✓) e anular (↺). Conclusão, reabertura e cancelamento usam as mesmas regras do web. Cancelamento exige confirmação.
- Lista: navegação por dia com calendário, alternância "Todos os dias", abas Em aberto/Encerradas. Card mostra "Produzir:" e, se diferente, "Usar em:". Atualização automática a cada 6 segundos.
- Queda de conexão durante criação bloqueia o reenvio até o funcionário voltar à lista e conferir o resultado.

Arquivos principais: `apps/mobile/src/production/ProductionOrdersScreen.tsx`, `NewProduction.tsx`, `OrderPreparationsStep.tsx`, `ProductionOrderDetail.tsx`, `DayPicker.tsx`, `Calculator.tsx`, `ReorderableList.tsx`, `order-ui.tsx` e `order-types.ts`.

API: `/api/mobile/production-orders`, com sessão bearer, respostas `no-store`, GET para listas (`?date=` filtra o dia; sem `date` lista todos), receitas e detalhe. POST com intents `preview`, `create` (aceita `baseIngredientId`, `date`, `usageDate` opcional), `save-recipe`, `define-preparations`, `start`, `step`, `finish`, `cancel` e `reorder` (`stepIds` na nova ordem). Cálculos e conversões puros ficam em `shared/production/order-plan.ts`; persistência e transições continuam em `production-order.server.ts`. O filtro de dia ocorre antes do limite de 200 registros.

Para disponibilizar nos tablets instalados, publicar o servidor com a API nova e distribuir a atualização do app. Exportar os bundles não equivale a gerar/instalar um APK nem a validar toque, teclado e layout no dispositivo físico.
