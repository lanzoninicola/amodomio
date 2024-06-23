/*
  Warnings:

  - Added the required column `base_price_amount` to the `menu_item` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_item" ADD COLUMN     "base_price_amount" DOUBLE PRECISION NOT NULL;
