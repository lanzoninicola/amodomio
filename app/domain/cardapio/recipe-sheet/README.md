# Recipe vs ItemCostSheet (Anti-duplicação)

## Objetivo

Evitar duplicação de dados entre cadastro técnico de produção e aplicação comercial no cardápio.

## Definições

- `Recipe`: base técnica reutilizável de preparo interno.
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
- A arquitetura deve forçar referência (`refId`) para reduzir divergência e retrabalho.
- Se houver conflito entre valor digitado e referência, prevalece a referência para consistência sistêmica.

## Nota de implementação

Quando houver divergência de custo entre cópia manual e referência, prevalece a referência (`refId`) para cálculo final.
