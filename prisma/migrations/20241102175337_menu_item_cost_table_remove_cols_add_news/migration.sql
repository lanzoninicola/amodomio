/*
  Warnings:

  - You are about to drop the column `average_cost` on the `menu_item_cost` table. All the data in the column will be lost.
  - You are about to drop the column `latest_cost` on the `menu_item_cost` table. All the data in the column will be lost.
  - You are about to drop the column `prev_average_cost` on the `menu_item_cost` table. All the data in the column will be lost.
  - You are about to drop the column `prev_latest_cost` on the `menu_item_cost` table. All the data in the column will be lost.
  - Added the required column `ingredients_cost` to the `menu_item_cost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_item_cost" DROP COLUMN "average_cost",
DROP COLUMN "latest_cost",
DROP COLUMN "prev_average_cost",
DROP COLUMN "prev_latest_cost",
ADD COLUMN     "ingredients_cost" DOUBLE PRECISION NOT NULL;
