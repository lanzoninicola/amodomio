# Recipe Composition ChatGPT Integration

## Objetivo

Accelerar o preenchimento da aba `Composição` da receita usando o projeto do ChatGPT `Receitas Builder`, mantendo um contrato de entrada e saída determinístico.

## Fluxo

1. Na rota `admin/recipes/:id/composicao`, o usuário abre a subpágina `Assistente`.
2. O sistema gera um prompt com:
   - dados da receita atual
   - variações permitidas
   - catálogo de ingredientes permitidos
   - regra para ingredientes ainda não cadastrados
   - composição atual
   - schema obrigatório de resposta
3. O usuário abre o projeto configurado em `Configurações globais`.
4. O usuário cola o prompt na conversa.
5. O ChatGPT deve responder apenas com um bloco `json`.
6. O usuário cola a resposta na subpágina do assistente, gera a pré-visualização e executa `Importar resposta`.
7. O backend valida o JSON, cria/atualiza os ingredientes cadastrados e usa `missingIngredients` apenas como lista de pendências.

## Contrato da resposta

O import aceita JSON puro ou um bloco markdown ` ```json ` com este formato:

```json
{
  "recipeId": "recipe_id_atual",
  "ingredients": [
    {
      "itemId": "item_id_obrigatorio",
      "unit": "UN",
      "defaultLossPct": 0,
      "variationQuantities": {
        "itemVariationId_1": 0,
        "itemVariationId_2": 0
      }
    }
  ],
  "missingIngredients": [
    {
      "name": "ingrediente_nao_cadastrado",
      "unit": "UN",
      "notes": "motivo ou observacao opcional"
    }
  ]
}
```

## Regras de validação

- `recipeId`, quando presente, deve corresponder à receita aberta.
- `itemId` deve existir no catálogo do sistema.
- `unit` é obrigatória.
- `defaultLossPct` deve estar entre `0` e `< 100`.
- `variationQuantities` deve existir para cada ingrediente importado.
- Cada chave de `variationQuantities` deve ser um `itemVariationId` vinculado à receita.
- Cada quantidade deve ser numérica e maior ou igual a `0`.
- `missingIngredients`, quando existir, deve trazer pelo menos `name`.

## Comportamento do import

- O import faz `upsert` apenas dos ingredientes citados em `ingredients`.
- Ingredientes não citados não são removidos.
- O `defaultLossPct` da composição base é atualizado.
- Cada célula de variação informada é recalculada com snapshot de custo atual.
- O campo `lossPct` das linhas importadas recebe o mesmo valor de `defaultLossPct`.
- `missingIngredients` não é importado automaticamente; serve para o ChatGPT apontar itens necessários ainda não cadastrados no sistema.

## Arquivos principais

- `app/routes/admin.recipes.$id.composicao.tsx`
- `app/routes/admin.recipes.$id.composition-builder.tsx`
- `app/routes/admin.recipes.$id.tsx`
- `app/routes/admin.administracao.settings._index.tsx`
- `app/domain/recipe/recipe-chatgpt-settings.ts`
- `app/domain/recipe/components/recipe-chatgpt-assistant-panel.tsx`

## Setting global usada

- `context`: `receitas`
- `name`: `assistente.composicao`
- valor default: `https://chatgpt.com/g/g-p-69b225bef6d48191bdb72274d331bfa8-receitas-builder/project`
