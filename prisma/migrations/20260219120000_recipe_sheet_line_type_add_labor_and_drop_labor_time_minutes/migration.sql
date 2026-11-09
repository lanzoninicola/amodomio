-- AlterEnum
ALTER TYPE "RecipeSheetLineType" ADD VALUE 'labor';

-- AlterTable
ALTER TABLE "recipe_sheets" DROP COLUMN "labor_time_minutes";
