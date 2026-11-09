DO $$
BEGIN
  ALTER TYPE "RecipeSheetLineType" ADD VALUE 'recipeSheet';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
