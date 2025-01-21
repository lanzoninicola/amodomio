/*
  Warnings:

  - Added the required column `quantity` to the `grocery_list_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "grocery_list_items" ADD COLUMN     "itemName" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL;
