# Recipe Worksheet

## Visão Geral

Página de gerenciamento de receitas em formato de **grid database** (estilo Airtable/Baserow), acessível em `/admin/recipes/worksheet`.

Permite visualizar, editar e gerenciar receitas e seus ingredientes (RecipeLines) em uma única tela, com edição inline por célula — sem necessidade de navegar para o detalhe de cada receita. O objetivo é simular a operatividade de um worksheet de Google Sheets para usuários com menos experiência.

---

## Arquivos

| Arquivo | Tipo | Descrição |
|---|---|---|
| `app/routes/admin.recipes.worksheet.tsx` | Criado | Página principal do worksheet |
| `app/routes/admin.recipes.tsx` | Modificado | Adicionadas tabs Lista / Worksheet no layout |

---

## Stack

- **Framework:** Remix v2 (loader + action server-side)
- **Database:** Prisma (PostgreSQL)
- **UI:** React 18 + TailwindCSS + Radix UI (Popover, Command) + shadcn/ui (Button)
- **Inputs numéricos:** `DecimalInput` de `~/components/inputs/inputs` (estilo calculadora)
- **Mutações inline:** `useFetcher` — sem reload de página

---

## Loader

Busca em paralelo:

- `Recipe` com `RecipeLine[]` → `Item` + `ItemVariation.Variation` + `Item` e `Variation` vinculados à receita
- `Item[]` ativos (até 500) para comboboxes — inclui `classification` e `consumptionUm`
- `MeasurementUnit[]` para opções de UM (fallback: `G, KG, L, ML, UN`)
- `Variation[]` ativas (até 200) para o select de variante da receita

```ts
const [recipes, items, unitOptions, variations] = await Promise.all([
    db.recipe.findMany({
        include: {
            Item: { select: { id, name } },
            Variation: { select: { id, name, kind } },
            RecipeLine: { include: { Item, ItemVariation: { Variation } } },
        },
    }),
    db.item.findMany({
        where: { active: true },
        take: 500,
        select: { id, name, classification, consumptionUm },
    }),
    getUnitOptions(db),
    db.variation.findMany({ where: { deletedAt: null }, take: 200 }),
])
```

### Tipo `WorksheetItem`

```ts
type WorksheetItem = {
    id: string
    name: string
    classification: string
    consumptionUm: string | null
}
```

---

## Helpers

### `itemLabel(item: WorksheetItem): string`

Formata o label do item para o campo `value` do combobox (usado para busca por teclado):

```ts
// "Farinha (Seco) · KG"
`${item.name} (${item.classification}) · ${item.consumptionUm ?? ""}`
```

### `filterItems(items, search): WorksheetItem[]`

Filtra itens por nome, classificação e UM de consumo (busca case-insensitive):

```ts
const q = search.toLowerCase()
return items.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.classification.toLowerCase().includes(q) ||
    (i.consumptionUm ?? "").toLowerCase().includes(q)
)
```

### `calcNome(recipe): string`

Deriva o nome calculado da receita a partir de `Item.name • Variation.name`:

```ts
const parts = [recipe.Item?.name, recipe.Variation?.name].filter(Boolean)
return parts.join(" • ")
```

---

## Actions

| `_action` | Operação |
|---|---|
| `recipe-update` | Atualiza `name`, `itemId` e/ou `variationId` de uma receita |
| `recipe-create` | Cria nova receita com `name`, `itemId`, `variationId` opcionais |
| `recipe-line-update` | Atualiza `unit` + `quantity` + recalcula `lastTotalCostAmount` / `avgTotalCostAmount` |
| `recipe-line-item-update` | Troca o `itemId` de uma linha existente e recalcula custo snapshot |
| `recipe-line-delete` | Remove `RecipeLine` por ID |
| `recipe-line-add` | Cria nova `RecipeLine` com custo snapshot do `ItemCostVariation` atual |

### recipe-update

```ts
await db.recipe.update({
    where: { id: recipeId },
    data: { name?, itemId?, variationId? },
})
```

### recipe-create

```ts
// itemId e variationId são opcionais mas enviados quando o usuário
// seleciona o item/variante na CreatingRecipeRow
await db.recipe.create({
    data: {
        name,
        type: "semiFinished",
        hasVariations: false,
        isVegetarian: false,
        isGlutenFree: false,
        ...(itemId ? { itemId } : {}),
        ...(variationId ? { variationId } : {}),
    },
})
```

### recipe-line-update

```ts
// Recalcula totais com base no custo atual do ItemCostVariation
const lastUnitCost = line.ItemVariation?.ItemCostVariation?.costAmount ?? line.lastUnitCostAmount
await db.recipeLine.update({
    where: { id: lineId },
    data: { unit, quantity, lastTotalCostAmount: lastUnitCost * quantity, ... }
})
```

### recipe-line-item-update

```ts
// Troca o ingrediente de uma linha existente, preservando unit e quantity
const itemVariation = await db.itemVariation.findFirst({ where: { itemId, deletedAt: null } })
await db.recipeLine.update({
    where: { id: lineId },
    data: { itemId, itemVariationId, lastUnitCostAmount, avgUnitCostAmount, lastTotalCostAmount, avgTotalCostAmount },
})
```

### recipe-line-add

```ts
// Usa a primeira ItemVariation ativa do item como snapshot de custo
const itemVariation = await db.itemVariation.findFirst({ where: { itemId, deletedAt: null } })
await db.recipeLine.create({ data: { recipeId, itemId, itemVariationId, unit, quantity, ... } })
```

---

## Componentes

```
RecipeWorksheet              ← página principal, toolbar compacta, grid, resize state
  └─ RecipeGroup             ← grupo por receita (collapsível)
       ├─ RecipeHeaderRow    ← linha-header da receita (nome, item, variante, nome calc, total)
       ├─ RecipeLineRow      ← linha de ingrediente (edição inline com DecimalInput)
       ├─ AddingRow          ← linha nova inline (combobox + UM + DecimalInput)
       └─ CreatingRecipeRow  ← linha verde para criar nova receita (item-first)
```

### RecipeWorksheet

- Filtro de receitas por nome (client-side)
- Botões **Expandir tudo** / **Recolher tudo** (shadcn `Button variant="ghost"`)
- Toolbar compacta (`py-2`) para maximizar espaço útil do grid
- Contador global de linhas para numeração sequencial de rows
- Estado `colWidths: number[]` com larguras em px de cada coluna
- Resize handler: `mousedown` no handle → `mousemove` no `window` → `mouseup`
- `isResizing` state: desativa `user-select` na tabela durante o arraste

### RecipeGroup

- Colapsável via click no header
- Delega a linha de cabeçalho para `RecipeHeaderRow`
- Botão `+ Adicionar ingrediente` (shadcn `Button variant="ghost" size="sm"`) ao fundo → ativa `AddingRow`

### RecipeHeaderRow

- Exibe e edita metadados da receita (name, itemId, variationId)
- **Nome**: click-to-edit → `<input>` com `autoFocus`; Enter/blur salva; Esc reverte
- **Item Vinculado**: Popover + Command combobox; permite remover vínculo via opção "Remover vínculo"
  - Cada opção exibe: nome (truncado) + classificação + UM à direita (`flex justify-between`)
- **Variante**: `<select>` nativo com todas as variações ativas
- **Nome Calculado**: campo somente-leitura derivado via `calcNome()` — `Item.name • Variation.name`
- **Total**: soma de `lastTotalCostAmount` de todas as RecipeLines
- **Link**: ícone `ExternalLink` para `/admin/recipes/:id`

### RecipeLineRow

- Props: `line`, `unitOptions`, `items`, `rowNumber`
- Estado local: `unit`, `defaultQty`, `currentQty`
  - `defaultQty` controla o reset do `DecimalInput` via seu `useEffect([defaultValue])`
  - `currentQty` rastreia o valor live via `onValueChange`
- `isDirty`: detecta mudança não salva → fundo âmbar + total em laranja
- **Ingrediente**: Popover + Command combobox — clicando no nome abre a busca; ao selecionar novo item chama `recipe-line-item-update` via `itemFetcher` (fetcher separado do de qty/unit)
- **Save:** `onBlur` ou `Enter` no `<td>` (bubbling) via `fetcher.submit()` → `recipe-line-update`
- **Cancel:** `Escape` reverte — reseta `defaultQty` (triggering reset do `DecimalInput`) e `currentQty`
- Total otimista: `currentQty * lastUnitCostAmount` recalculado localmente
- Botão deletar: visível no hover da linha (ícone `Trash2`)

```tsx
// Padrão de quantidade com DecimalInput
const [currentQty, setCurrentQty] = useState(line.quantity)
const [defaultQty, setDefaultQty] = useState(line.quantity)

<td className={CELL_EDITABLE} onBlur={save} onKeyDown={handleKey}>
    <DecimalInput
        name="lineQuantity"
        defaultValue={defaultQty}
        fractionDigits={4}
        onValueChange={setCurrentQty}
        className="w-full h-8 px-2 bg-transparent border-0 outline-none text-sm text-slate-700 text-right"
    />
</td>
```

### AddingRow

- Abre automaticamente o combobox de ingredientes (`comboOpen: true` no mount)
- Cada opção do combobox exibe: nome (truncado) + classificação + UM (`flex justify-between`)
- Após selecionar item → foco vai para Quantidade via `qtyContainerRef` + `querySelector`
- `qtyValue` (number) rastreia o valor via `onValueChange` do `DecimalInput`
- Botão `✓` desabilitado quando `!selectedItemId || qtyValue <= 0`
- `Enter` confirma · `Esc` cancela

```tsx
const [qtyValue, setQtyValue] = useState(0)
const qtyContainerRef = useRef<HTMLDivElement>(null)

// foco após seleção de item:
setTimeout(() => qtyContainerRef.current
    ?.querySelector<HTMLInputElement>("input:not([type='hidden'])")
    ?.focus(), 50)

<td className={CELL_EDITABLE} onKeyDown={handleKey}>
    <div ref={qtyContainerRef}>
        <DecimalInput
            name="lineQuantity"
            defaultValue={0}
            fractionDigits={4}
            onValueChange={setQtyValue}
            className="w-full h-8 px-2 bg-transparent border-0 outline-none text-sm text-slate-700 text-right"
        />
    </div>
</td>
```

### CreatingRecipeRow

- **Item é o campo primário**: combobox abre automaticamente no mount (`itemComboOpen: true`)
- Cada opção do combobox exibe: nome (truncado) + classificação + UM (`flex justify-between`)
- `buildAutoName(itemName, variationName?)`: `"Receita <item> (<variante>)"` ou `"Receita <item>"`
- `nameAutoSet` boolean — se `true`, nome é auto-preenchido e sincronizado com variante
- Ao selecionar item → nome auto-preenchido → `setNameAutoSet(true)` → foco vai para campo Nome
- Ao selecionar variante (com `nameAutoSet === true`) → nome atualizado automaticamente
- Ao editar nome manualmente → `setNameAutoSet(false)` (desativa auto-preenchimento)
- `Enter` ou botão `✓` cria a receita com `name`, `itemId` e `variationId`
- `Esc` ou botão `✗` cancela
- Destaque visual: fundo verde claro + borda superior verde

---

## Grid Visual

Inspirado no layout de database grid do [Baserow](https://baserow.io) / [Airtable](https://airtable.com).

### Layout de colunas — duplo significado

A tabela usa 8 colunas fixas que têm significados diferentes nas linhas de cabeçalho de receita e nas linhas de ingrediente:

| Col | Largura padrão | Mínima | Linha receita (header) | Linha ingrediente |
|-----|---------------|--------|------------------------|-------------------|
| 1 | 36px | 36px | expand/collapse | `#` row number |
| 2 | 240px | 80px | Nome Receita (editável) | Ingrediente (combobox) |
| 3 | 160px | 80px | Item Vinculado (combobox) | Variação Ing. (read-only) |
| 4 | 96px | 60px | Variante (select) | UM (select) |
| 5 | 106px | 60px | Nome Calculado (read-only) | Quantidade (DecimalInput) |
| 6 | 112px | 80px | — | Custo Un. (read-only) |
| 7 | 112px | 80px | Total (read-only) | Total (otimista) |
| 8 | 36px | 36px | Link externo | Botão delete (hover) |

```ts
const DEFAULT_COL_WIDTHS = [36, 240, 160, 96, 106, 112, 112, 36]
const MIN_COL_WIDTHS     = [36,  80,  80, 60,  60,  80,  80, 36]
```

### Redimensionamento de colunas

- Handle de resize na borda direita de cada `<th>` (exceto cols 1 e 8)
- `mousedown` no handle inicia o resize: captura `colIndex`, `startX`, `startWidth` via `resizeRef`
- `mousemove` no `window` atualiza `colWidths[col] = max(minWidth, startWidth + delta)`
- `mouseup` no `window` finaliza o resize e limpa `resizeRef`
- `select-none` aplicado na tabela durante o arraste para evitar seleção de texto
- Larguras não persistidas — `colWidths` é estado React local, resetado ao recarregar a página

### Combobox de itens — layout das opções

Cada opção nos três comboboxes (RecipeHeaderRow, AddingRow, CreatingRecipeRow) usa:

```tsx
<div className="flex justify-between min-w-0 w-full gap-2">
    <span className="truncate">{item.name}</span>
    <span className="shrink-0 text-xs text-slate-400">
        {item.classification} · {item.consumptionUm}
    </span>
</div>
```

- `flex justify-between` distribui nome à esquerda e badge à direita
- `truncate` no nome evita quebra de linha em nomes longos
- `shrink-0` no badge garante que classificação + UM nunca sejam comprimidos

### CSS — Célula com foco (estilo Baserow)

```tsx
const CELL              = "border border-slate-200 h-8"
const CELL_HDR          = cn(CELL, "bg-slate-50")
const CELL_RECIPE       = cn(CELL, "bg-slate-50/70")
const CELL_EDITABLE     = cn(CELL, "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset focus-within:z-10 relative")
const CELL_RECIPE_EDITABLE = cn(CELL_RECIPE, "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset focus-within:z-10 relative")
const INPUT_BASE        = "w-full h-full px-2 bg-transparent border-0 outline-none text-sm text-slate-700 placeholder:text-slate-300"
```

- `border-collapse: collapse` + `tableLayout: fixed`
- `focus-within:ring-2 ring-blue-500 ring-inset` — anel azul na célula quando filho está focado
- Inputs sem borda própria — a célula é o container visual do foco
- `onBlur` e `onKeyDown` ficam no `<td>`, não no input (React's `onBlur` bubbles via `focusout`)
- Rows com altura fixa `h-8` (32px); header de receita `h-9` com `border-t-2`

### `DecimalInput` — integração

`DecimalInput` (de `~/components/inputs/inputs`) é um input no estilo calculadora:

- `defaultValue` → valor inicial; `useEffect([defaultValue])` interno reseta display ao mudar a prop
- `onValueChange` → callback chamado a cada tecla com o valor numérico atual
- Renderiza `<div><input type="text" .../><input type="hidden" name=... /></div>`
- `Enter` não é capturado — borbulha para o `<td>` pai
- Para obter foco programático: `containerRef.querySelector("input:not([type='hidden'])")`

---

## UX — Fluxo de edição

### Editar metadados de uma receita

1. Clicar no **Nome** da receita → input aparece com autoFocus
2. Editar e pressionar `Enter` ou clicar fora → salva via `useFetcher`
3. `Esc` → reverte ao valor salvo
4. Clicar em **Item Vinculado** → combobox abre para busca/seleção (busca por nome, classificação ou UM)
5. Clicar em **Variante** → select nativo para escolher a variação

### Criar nova receita

1. Clicar em `+ Nova Receita` ao fundo do grid
2. Linha verde aparece; combobox de **Item** abre automaticamente
3. Buscar e selecionar o item → nome auto-preenchido como `"Receita <item>"`, foco vai para o campo Nome
4. (opcional) Selecionar Variante → nome atualizado para `"Receita <item> (<variante>)"`
5. (opcional) Editar o nome manualmente (desativa o auto-preenchimento)
6. `Enter` ou botão `✓` → cria receita com nome, itemId e variationId
7. `Esc` ou botão `✗` → cancela

### Adicionar ingrediente a uma receita

1. Expandir o grupo e clicar em `+ Adicionar ingrediente`
2. Nova linha azul aparece com combobox de ingrediente já aberto
3. Selecionar ingrediente → foco vai para Quantidade (DecimalInput)
4. Ajustar UM e Quantidade (estilo calculadora: digitar acumula dígitos)
5. `Enter` ou botão `✓` → salva
6. `Esc` ou botão `✗` → cancela

### Editar ingrediente existente

**Trocar o ingrediente:**
1. Clicar na célula do nome do ingrediente → combobox abre com busca
2. Buscar e selecionar o novo ingrediente → salva imediatamente via `recipe-line-item-update`
3. A quantidade e UM são preservadas; custo snapshot é atualizado com a `ItemVariation` ativa do novo item

**Editar UM ou Quantidade:**
1. Clicar na célula **UM** ou **Quantidade**
2. Célula destaca com anel azul
3. Editar o valor (DecimalInput: Backspace remove último dígito, Delete zera)
4. `Enter` ou `Tab` (blur) → salva via `useFetcher` → `recipe-line-update` (sem reload)
5. `Esc` → cancela e reverte ao valor salvo

### Deletar ingrediente

1. Hover na linha → ícone de lixeira aparece na última coluna
2. Clicar → remove via `useFetcher` (sem confirmação)

---

## Limitações / Possíveis extensões

| Limitação | Detalhe |
|---|---|
| **Variação do ingrediente** não editável | Apenas no detalhe da receita (`/admin/recipes/:id`); ao trocar o item, a primeira `ItemVariation` ativa é usada como snapshot |
| **Reordenação** não implementada | Drag-and-drop de `sortOrderIndex` não suportado |
| **Custo médio** não exibido | Apenas `lastUnitCostAmount` é mostrado; custo médio está no detalhe |
| **Recalcular custos** | Snapshot de custo é feito no momento da criação; recalc manual está no detalhe |
| **Virtualização** não implementada | Pode ser lento com centenas de receitas/linhas |
| **Larguras não persistidas** | `colWidths` é estado React local — resetado ao recarregar a página |
| **Delete de receita** | Não disponível no worksheet; usar o detalhe da receita |
