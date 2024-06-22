/*
  Warnings:

  - Added the required column `updated_at` to the `menu_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `menu_item_price` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_item" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "menu_item_price" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
