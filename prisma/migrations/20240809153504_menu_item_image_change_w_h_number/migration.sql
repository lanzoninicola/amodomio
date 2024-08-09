/*
  Warnings:

  - The `height` column on the `menu_items_image` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `width` column on the `menu_items_image` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "menu_items_image" DROP COLUMN "height",
ADD COLUMN     "height" DOUBLE PRECISION,
DROP COLUMN "width",
ADD COLUMN     "width" DOUBLE PRECISION;
