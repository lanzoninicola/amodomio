/*
  Warnings:

  - You are about to drop the column `show_in_menu` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `show_in_menu` on the `recipes` table. All the data in the column will be lost.
  - The `type` column on the `recipes` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('semi-finished', 'topping');

-- AlterTable
ALTER TABLE "products" DROP COLUMN "show_in_menu";

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "show_in_menu",
DROP COLUMN "type",
ADD COLUMN     "type" "RecipeType" NOT NULL DEFAULT 'semi-finished';
