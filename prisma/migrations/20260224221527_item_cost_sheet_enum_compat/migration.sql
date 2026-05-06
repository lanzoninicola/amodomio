-- Compatibilidade pós-renomeação conceitual:
-- mantém os nomes novos no Prisma Client via @@map, mas preserva os nomes físicos
-- legados no banco para não quebrar migrações históricas.
--
-- A migração anterior criou os enums "ItemCostSheet*" e removeu "RecipeSheet*".
-- Migrações posteriores ainda referenciam "RecipeSheet*". Aqui renomeamos os tipos
-- físicos de volta sem recriar colunas (sem perda de dados).

ALTER TYPE "ItemCostSheetStatus" RENAME TO "RecipeSheetStatus";
ALTER TYPE "ItemCostSheetLineType" RENAME TO "RecipeSheetLineType";

-- As migrações históricas posteriores ainda assumem que o enum contém `product`
-- até que ele seja removido explicitamente em 20260723001800_drop_product_model.
DO $$
BEGIN
  ALTER TYPE "RecipeSheetLineType" ADD VALUE 'product';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
