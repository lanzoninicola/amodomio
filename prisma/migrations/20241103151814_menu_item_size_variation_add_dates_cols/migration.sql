/*
  Warnings:

  - Added the required column `created_at` to the `menu_item_size_variations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_item_size_variations" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
