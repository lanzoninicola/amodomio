/*
  Warnings:

  - You are about to drop the column `menu_item_id` on the `recipe_sheets` table. All the data in the column will be lost.
  - You are about to drop the column `menu_item_size_id` on the `recipe_sheets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[item_id,item_variation_id,version]` on the table `recipe_sheets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `item_variation_id` to the `recipe_sheets` table without a default value. This is not possible if the table is not empty.
  - Made the column `item_id` on table `recipe_sheets` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "recipe_sheets" DROP CONSTRAINT "recipe_sheets_item_id_fkey";

-- DropForeignKey
ALTER TABLE "recipe_sheets" DROP CONSTRAINT "recipe_sheets_menu_item_id_fkey";

-- DropForeignKey
ALTER TABLE "recipe_sheets" DROP CONSTRAINT "recipe_sheets_menu_item_size_id_fkey";

-- DropIndex
DROP INDEX "recipe_sheets_item_size_active_idx";

-- DropIndex
DROP INDEX "recipe_sheets_item_size_idx";

-- DropIndex
DROP INDEX "recipe_sheets_item_size_version_unique";

-- AlterTable
ALTER TABLE "recipe_sheets" DROP COLUMN "menu_item_id",
DROP COLUMN "menu_item_size_id",
ADD COLUMN     "item_variation_id" TEXT NOT NULL,
ALTER COLUMN "item_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "recipe_sheets_item_variation_id_idx" ON "recipe_sheets"("item_variation_id");

-- CreateIndex
CREATE INDEX "recipe_sheets_item_variation_idx" ON "recipe_sheets"("item_id", "item_variation_id");

-- CreateIndex
CREATE INDEX "recipe_sheets_item_variation_active_idx" ON "recipe_sheets"("item_id", "item_variation_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_sheets_item_variation_version_unique" ON "recipe_sheets"("item_id", "item_variation_id", "version");

-- AddForeignKey
ALTER TABLE "recipe_sheets" ADD CONSTRAINT "recipe_sheets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_sheets" ADD CONSTRAINT "recipe_sheets_item_variation_id_fkey" FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
