/*
  Warnings:

  - Added the required column `isVegetarian` to the `menu_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mogoId` to the `menu_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "isVegetarian" BOOLEAN NOT NULL,
ADD COLUMN     "mogoId" TEXT NOT NULL;
