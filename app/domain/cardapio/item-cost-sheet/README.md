# Recipe vs ItemCostSheet (Anti-duplicação)

## Objetivo

Evitar duplicação de dados entre cadastro técnico de produção e aplicação comercial no cardápio.

## Definições

- `Recipe`: base técnica reutilizável de preparo interno.
  - representa composição, UM, quantidade, perda e organização de produção
  - não persiste custo
  - não é a UI operacional de custo
- `ItemCostSheet`: aplicação de custo por item+variação.
  - responde quanto de `ficha de custo`/`recipe` entra no item final
  - agrega custos específicos de venda (embalagem, mão de obra, ajustes manuais, perda final)

## Regras de negócio

1. Todo item final do cardápio deve ter custo calculado a partir de uma `ItemCostSheet` ativa por variação.
2. Subpreparo/semiacabado deve ser consumido por referência de `ItemCostSheet` (tipo `recipeSheet`) ou `Recipe`, nunca por cópia manual.
3. Linha do tipo `recipeSheet` armazena apenas `refId` + `quantity` + parâmetros de ajuste da linha.
4. Linhas do tipo `product` podem referenciar insumo comprado diretamente.
5. Linhas `manual` e `labor` existem para custos que não nascem de cadastro técnico (ajustes e mão de obra).
6. Só deve existir uma `ItemCostSheet` ativa por combinação de item + variação.
7. Ativar nova ficha deve desativar a anterior da mesma combinação.
8. Mudança de custos em fichas referenciadas deve refletir no cálculo da ficha consumidora (recalcular).
9. Custo usado na precificação de venda deve vir da `ItemCostSheet` ativa (fonte operacional).
10. `Recipe` não é fonte final de custo de venda; é apoio técnico de produção/processo.
11. Quando a ficha possui linha do tipo `recipe`, o custo dessa linha deve ser calculado em tempo de recálculo da ficha a partir da composição atual da receita e do custo atual dos insumos.

## Regra de ouro

1. Nunca copiar composição de uma ficha para outra.
2. Na `ItemCostSheetLine` do tipo `recipeSheet` (UI: `Ficha de custo do item`), salvar somente `refId` + `quantity` usada.
3. O custo da linha `recipeSheet` deve ser calculado por referência:
   - `lineCost = custoAtualFichaReferenciada x quantity`
4. `ItemCostSheet` deve agregar apenas referências + custos específicos de venda.

## Source of truth

- Produção/semiacabado: `Recipe` (composição técnica)
- Precificação comercial por item+variação: `ItemCostSheet`

## Ponto de vista arquitetural (Codex)

- `Recipe` e `ItemCostSheet` não são duplicados quando papéis são separados:
  - `Recipe`: conhecimento técnico de produção
  - `ItemCostSheet`: decisão econômica/comercial de custo
- O erro clássico é deixar as duas entidades armazenarem custo final em paralelo.
- `Recipe` pode participar do calculo da ficha sem armazenar custo nela mesma.
- A arquitetura deve forçar referência (`refId`) para reduzir divergência e retrabalho.
- Se houver conflito entre valor digitado e referência, prevalece a referência para consistência sistêmica.

## Nota de implementação

Quando houver divergência de custo entre cópia manual e referência, prevalece a referência (`refId`) para cálculo final.

## Guia para Assistente de IA

Esta seção existe para orientar agentes de IA que precisem ler, editar, validar ou operar a funcionalidade de ficha técnica no produto.

### Objetivo operacional da ficha técnica

- A `ItemCostSheet` representa o custo operacional/comercial de um item do cardápio por variação.
- O custo final usado na precificação deve sair da ficha ativa.
- A ficha agrega componentes de naturezas diferentes:
  - `recipe`: custo calculado a partir da composição da receita técnica
  - `recipeSheet`: custo vindo de outra ficha técnica
  - `manual`: custo digitado manualmente, como embalagem
  - `labor`: custo manual de mão de obra

### Separação de conceitos

- `Recipe` responde: "como produzir?"
- `ItemCostSheet` responde: "quanto custa operacionalmente/comercialmente?"
- O usuário pode montar e revisar a produção em `Recipe` sem enxergar totais monetários.
- Quando a receita precisa participar da precificação, ela entra na ficha como uma referência do tipo `recipe`.
- O custo dessa linha referenciada deve ser derivado da composição atual da receita e do custo atual dos insumos, nunca de valor persistido ou digitado manualmente na UI da receita.

### Modelo mental

- Existe uma ficha raiz (`rootSheetId`) que agrupa a composição.
- Podem existir fichas derivadas por variação ligadas por `baseItemCostSheetId`.
- A tela `/admin/item-cost-sheets/:id/custos` edita a composição da ficha raiz e distribui/edita valores por variação.
- Cada linha da composição possui:
  - metadados da linha: `id`, `type`, `refId`, `name`, `notes`, `sortOrderIndex`
  - valores por variação em `variationValues`
- Cada valor por variação possui:
  - `itemVariationId`
  - `unit`
  - `quantity`
  - `unitCostAmount`
  - `wastePerc`
  - `totalCostAmount`

### Arquivos principais

- `app/routes/admin.item-cost-sheets.$id.tsx`
  Responsável por loader, action e regras de atualização da ficha.
- `app/routes/admin.item-cost-sheets.$id.custos.tsx`
  UI da aba de composição/custos.
- `app/domain/costs/item-cost-sheet-recalc.server`
  Regras de recálculo, snapshots e arredondamento monetário.

### Regras de edição por tipo de linha

- `recipe`
  - É uma linha referenciada por receita.
  - `name` e `unitCostAmount` são derivados do cálculo atual da composição da receita.
  - Na edição manual da linha, o usuário só deve alterar:
    - `quantity`
    - `wastePerc`
    - `notes`
  - `unitCostAmount` não deve prevalecer sobre a referência.

- `recipeSheet`
  - É uma linha referenciada por outra ficha técnica.
  - Deve armazenar `refId` e parâmetros de consumo da referência.
  - Não pode criar ciclo entre fichas.
  - `unitCostAmount` vem da ficha referenciada por variação.
  - Na edição manual da linha, o usuário só deve alterar:
    - `quantity`
    - `wastePerc`
    - `notes`

- `manual`
  - É uma linha totalmente editável.
  - Deve aceitar edição de:
    - `name`
    - `notes`
    - `unit`
    - `quantity`
    - `unitCostAmount`
    - `wastePerc`

- `labor`
  - Mesmo comportamento de `manual`, mas semanticamente representa mão de obra.

### Fórmula de custo

- O total da linha por variação é calculado com:
  - `totalCostAmount = calcItemCostSheetTotalCostAmount(unitCostAmount, quantity, wastePerc)`
- Após alterar qualquer linha, a ficha deve ser recalculada:
  - `recalcItemCostSheetTotals(db, rootSheetId)`

### Ações suportadas na route

As ações abaixo vivem em `app/routes/admin.item-cost-sheets.$id.tsx`.

- `item-cost-sheet-line-add-recipe`
  - Adiciona linha do tipo `recipe`
  - Usa cálculo da composição da receita por variação

- `item-cost-sheet-line-add-sheet`
  - Adiciona linha do tipo `recipeSheet`
  - Usa snapshot da ficha referenciada por variação
  - Deve bloquear autorreferência e ciclos

- `item-cost-sheet-line-add-manual`
  - Adiciona linha `manual`

- `item-cost-sheet-line-add-labor`
  - Adiciona linha `labor`

- `item-cost-sheet-line-update`
  - Atualiza uma linha existente e seus valores por variação
  - Para linhas referenciadas, `unitCostAmount` continua vindo da referência

- `item-cost-sheet-line-move`
  - Move a linha para cima ou para baixo

- `item-cost-sheet-line-delete`
  - Remove a linha da composição

- `item-cost-sheet-line-recalc`
  - Força recálculo da ficha

- `item-cost-sheet-delete`
  - Remove a ficha se não houver bloqueios

### Validações importantes

- `quantity` deve ser `> 0`
- `unitCostAmount` deve ser `>= 0`
- `unit` deve existir e ser válida para linhas `manual` e `labor`
- Não pode haver ciclo em referência `recipeSheet`
- Não é permitido remover ficha ativa
- Se uma linha referenciada divergir do snapshot, deve prevalecer a referência para `unitCostAmount`

### Regras de interface da aba `/custos`

- Todos os valores numéricos e monetários da grade estão padronizados em `2` casas decimais.
- `Custo un.` na composição usa `MoneyInput`.
- `Total` é exibido como somente leitura.
- A tela possui atalho `Ctrl+S` / `Cmd+S` para salvar:
  - primeiro tenta salvar a linha atualmente focada
  - se não houver foco em linha, salva a primeira linha editável

### Cuidados para agentes de IA

- Não transformar linha referenciada (`recipe` ou `recipeSheet`) em linha manual por edição direta.
- Não permitir que `unitCostAmount` digitado sobrescreva referência em linhas referenciadas.
- Não reintroduzir totais monetários como source of truth dentro da UI de `Recipe`.
- Ao mexer em `MoneyInput`, lembrar que formulários externos ao `<Form>` exigem repasse do atributo `form` também para o `input hidden`.
- Ao alterar escala decimal na UI, revisar também:
  - parsing no `action`
  - cálculo de total
  - snapshots e arredondamento monetário

### Fluxo recomendado para um agente

1. Identificar o tipo da linha.
2. Verificar se a linha é referenciada ou manual.
3. Aplicar validações de `quantity`, `unit`, `unitCostAmount` e `wastePerc`.
4. Atualizar `ItemCostSheetVariationComponent` por variação.
5. Recalcular totais da ficha.
6. Preservar a regra de referência como source of truth para `recipe` e `recipeSheet`.
