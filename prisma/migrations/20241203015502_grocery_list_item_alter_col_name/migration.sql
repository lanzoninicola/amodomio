/*
  Warnings:

  - You are about to drop the column `itemName` on the `grocery_list_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "grocery_list_items" DROP COLUMN "itemName",
ADD COLUMN     "name" TEXT;
