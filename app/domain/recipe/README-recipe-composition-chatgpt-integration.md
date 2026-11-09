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
7. O backend valida o JSON, cria/atualiza/remove os ingredientes cadastrados e usa `missingIngredients` apenas como lista de pendências.

## Contrato da resposta

O import aceita JSON puro ou um bloco markdown ` ```json ` com este formato:

```json
{
  "recipeId": "recipe_id_atual",
  "ingredients": [
    {
      "itemId": "item_id_obrigatorio",
      "action": "upsert",
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

`action` aceita:

- `upsert`: ingrediente que deve entrar, permanecer ou ser atualizado na composição. Sempre inclua `unit`, `defaultLossPct` e `variationQuantities`.
- `delete`: reservado para casos onde `COMPOSICAO_ATUAL` está vazia. Quando há ingredientes em `COMPOSICAO_ATUAL`, a eliminação é feita pelo usuário no sistema — não use `delete`.

## Regras para o assistente AI

- **Regra absoluta**: quando `COMPOSICAO_ATUAL` não estiver vazia, cada `itemId` presente nela **deve** aparecer na resposta com `action: "upsert"` e `variationQuantities` preenchidas.
- **Proibido** usar `action: "delete"` para qualquer `itemId` presente em `COMPOSICAO_ATUAL`; a decisão de eliminar cabe ao usuário no sistema.
- Para cada ingrediente de `COMPOSICAO_ATUAL`, sugira a quantidade adequada por variação; se não entrar em uma variação, use `0`.
- Após incluir todos os ingredientes de `COMPOSICAO_ATUAL`, você pode sugerir ingredientes extras do catálogo com `action: "upsert"`; o usuário avalia e elimina o que não quiser.
- **Verificação final antes de responder**: confirme que cada `itemId` de `COMPOSICAO_ATUAL` está presente em `ingredients` com `action: "upsert"` e `variationQuantities` preenchidas.
- Se o ingrediente necessário não existir no catálogo permitido, liste em `missingIngredients` e não force um `itemId` incorreto.
- Não invente `itemId` nem `itemVariationId`; use apenas IDs enviados no prompt.
- Para ingredientes com `action: "upsert"`, informe `unit`, `defaultLossPct` e `variationQuantities` para todas as variações permitidas.

## Regras de validação

- `recipeId`, quando presente, deve corresponder à receita aberta.
- `itemId` deve existir no catálogo do sistema.
- `action`, quando presente, deve ser `upsert` ou `delete`; quando omitida, o backend trata como `upsert`.
- `unit` é obrigatória para ingredientes com `action: "upsert"`.
- `defaultLossPct` deve estar entre `0` e `< 100` para ingredientes com `action: "upsert"`.
- `variationQuantities` deve existir para cada ingrediente importado com `action: "upsert"`.
- Cada chave de `variationQuantities` deve ser um `itemVariationId` vinculado à receita.
- Cada quantidade deve ser numérica e maior ou igual a `0`.
- `missingIngredients`, quando existir, deve trazer pelo menos `name`.

## Comportamento da prévia

- A prévia mostra uma tabela com `Ingrediente`, `Variação`, `UM`, `Quantidade` e `Perda`.
- Ingredientes novos aparecem com o badge `Adicionado`.
- Ingredientes com `action: "delete"` aparecem com o badge `Eliminado`.
- O usuário pode remover a marca de eliminação antes de importar; nesse caso o ingrediente é preservado.
- A tabela permite filtrar por variação.

## Comportamento do import

- O import faz `upsert` dos ingredientes citados com `action: "upsert"`.
- O import remove da composição os ingredientes citados com `action: "delete"`, exceto quando o usuário remove a marca de eliminação na prévia.
- Ingredientes não citados não são removidos.
- O `defaultLossPct` da composição base é atualizado.
- Cada célula de variação informada é recalculada com snapshot de custo atual.
- O campo `lossPct` das linhas importadas recebe o mesmo valor de `defaultLossPct`.
- `missingIngredients` não é importado automaticamente; serve para o ChatGPT apontar itens necessários ainda não cadastrados no sistema.
- Após importação bem-sucedida, a tela navega para a aba `Variações`.

## Arquivos principais

- `app/routes/admin.recipes.$id.composicao.tsx`
- `app/routes/admin.recipes.$id.composition-builder.tsx`
- `app/routes/admin.recipes.$id.tsx`
- `app/routes/admin.administracao.settings._index.tsx`
- `app/domain/recipe/recipe-composition-chatgpt-assistant.ts`
- `app/domain/recipe/recipe-chatgpt-settings.ts`
- `app/domain/recipe/components/recipe-chatgpt-assistant-panel.tsx`

## Setting global usada

- `context`: `receitas`
- `name`: `assistente.composicao`
- valor default: `https://chatgpt.com/g/g-p-69b225bef6d48191bdb72274d331bfa8-receitas-builder/project`
