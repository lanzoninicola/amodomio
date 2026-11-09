/*
  Warnings:

  - The `type` column on the `recipe_sheet_lines` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `recipe_sheets` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ItemCostSheetStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ItemCostSheetLineType" AS ENUM ('recipe', 'recipeSheet', 'manual', 'labor');

-- AlterTable
ALTER TABLE "recipe_sheet_lines" DROP COLUMN "type",
ADD COLUMN     "type" "ItemCostSheetLineType" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "recipe_sheets" DROP COLUMN "status",
ADD COLUMN     "status" "ItemCostSheetStatus" NOT NULL DEFAULT 'draft';

-- DropEnum
DROP TYPE "RecipeSheetLineType";

-- DropEnum
DROP TYPE "RecipeSheetStatus";
