/*
  Warnings:

  - You are about to drop the column `cost_base` on the `menu_item_sizes` table. All the data in the column will be lost.
  - You are about to drop the column `cost_scaling_factor` on the `menu_item_sizes` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `menu_item_sizes` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `menu_item_sizes` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "menu_item_sizes_slug_key";

-- AlterTable
ALTER TABLE "menu_item_sizes" DROP COLUMN "cost_base",
DROP COLUMN "cost_scaling_factor",
DROP COLUMN "group",
DROP COLUMN "slug";
