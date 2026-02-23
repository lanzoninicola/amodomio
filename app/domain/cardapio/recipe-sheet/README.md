# Recipe vs RecipeSheet (Anti-duplicação)

## Objetivo

Evitar duplicação de dados entre cadastro técnico de produção e aplicação comercial no cardápio.

## Definições

- `Recipe`: base técnica reutilizável de preparo interno (legado e/ou documentação de processo).
- `RecipeSheet`: aplicação de custo por item+tamanho.
  - responde quanto de `ficha técnica`/`product` entra no sabor+tamanho
  - agrega custos específicos de venda (embalagem, mão de obra, ajustes manuais, perda final)

## Regras de negócio

1. Todo item final do cardápio deve ter custo calculado a partir de uma `RecipeSheet` ativa por tamanho.
2. Subpreparo/semiacabado deve ser consumido por referência de `RecipeSheet` (tipo `recipeSheet`), nunca por cópia manual.
3. Linha do tipo `recipeSheet` armazena apenas `refId` + `quantity` + parâmetros de ajuste da linha.
4. Linhas do tipo `product` podem referenciar insumo comprado diretamente.
5. Linhas `manual` e `labor` existem para custos que não nascem de cadastro técnico (ajustes e mão de obra).
6. Só deve existir uma `RecipeSheet` ativa por combinação `menuItemId + menuItemSizeId`.
7. Ativar nova ficha deve desativar a anterior da mesma combinação.
8. Mudança de custos em fichas referenciadas deve refletir no cálculo da ficha consumidora (recalcular).
9. Custo usado na precificação de venda deve vir da `RecipeSheet` ativa (fonte operacional).
10. `Recipe` não é fonte final de custo de venda; é apoio técnico de produção/processo.

## Regra de ouro

1. Nunca copiar composição de uma ficha para outra.
2. Na `RecipeSheetLine` do tipo `recipeSheet` (UI: `Ficha técnica`), salvar somente `refId` + `quantity` usada.
3. O custo da linha `recipeSheet` deve ser calculado por referência:
   - `lineCost = custoAtualFichaReferenciada x quantity`
4. `RecipeSheet` deve agregar apenas referências + custos específicos de venda.

## Source of truth

- Produção/semiacabado: `RecipeSheet` do subpreparo
- Precificação comercial por item+tamanho: `RecipeSheet`

## Ponto de vista arquitetural (Codex)

- `Recipe` e `RecipeSheet` não são duplicados quando papéis são separados:
  - `Recipe`: conhecimento técnico de produção
  - `RecipeSheet`: decisão econômica/comercial de custo
- O erro clássico é deixar as duas entidades armazenarem custo final em paralelo.
- A arquitetura deve forçar referência (`refId`) para reduzir divergência e retrabalho.
- Se houver conflito entre valor digitado e referência, prevalece a referência para consistência sistêmica.

## Nota de implementação

Quando houver divergência de custo entre cópia manual e referência, prevalece a referência (`refId`) para cálculo final.
