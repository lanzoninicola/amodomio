/*
  Warnings:

  - You are about to drop the column `isVegetarian` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `mogoId` on the `menu_items` table. All the data in the column will be lost.
  - Added the required column `is_vegetarian` to the `menu_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mogo_id` to the `menu_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "isVegetarian",
DROP COLUMN "mogoId",
ADD COLUMN     "is_vegetarian" BOOLEAN NOT NULL,
ADD COLUMN     "mogo_id" TEXT NOT NULL;
