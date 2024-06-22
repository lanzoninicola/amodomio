/*
  Warnings:

  - You are about to drop the `MenuItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuItemPrice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_category_id_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemPrice" DROP CONSTRAINT "MenuItemPrice_menuItemId_fkey";

-- DropTable
DROP TABLE "MenuItem";

-- DropTable
DROP TABLE "MenuItemPrice";

-- CreateTable
CREATE TABLE "menu_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_prices" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "menu_item_prices_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_prices" ADD CONSTRAINT "menu_item_prices_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
