/*
  Warnings:

  - You are about to drop the column `menuItemId` on the `menu_item_price` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_price" DROP CONSTRAINT "menu_item_price_menuItemId_fkey";

-- AlterTable
ALTER TABLE "menu_item_price" DROP COLUMN "menuItemId",
ADD COLUMN     "menu_item_id" TEXT;

-- AddForeignKey
ALTER TABLE "menu_item_price" ADD CONSTRAINT "menu_item_price_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
