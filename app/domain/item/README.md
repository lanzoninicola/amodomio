# Domínio Item

Este documento descreve as regras de negócio associadas aos flags de operação do `Item`.

## Flags de operação (regra simples)

- `canPurchase`: o item pode ser comprado/abastecido (fluxos de compra e importação de NF).
- `canTransform`: o item pode participar de transformação/produção (receitas/fichas técnicas).
- `canSell`: o item pode ser vendido.
- `canStock`: o item controla estoque.
- `canSell` **controla a disponibilidade no cardápio** (derivado).
  - O campo `canBeInMenu` não existe mais; use `canSell` como fonte única.

## Observações práticas

- Evite combinações incoerentes (ex.: item vendável sem custo definido).
- Para custos, `canTransform` tende a indicar custo vindo de receita/ficha técnica; `canPurchase` tende a indicar custo vindo de compra.
