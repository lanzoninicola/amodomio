/*
  Warnings:

  - You are about to drop the `menu_item_prices` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_prices" DROP CONSTRAINT "menu_item_prices_menuItemId_fkey";

-- DropTable
DROP TABLE "menu_item_prices";

-- CreateTable
CREATE TABLE "menu_item_price" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "menu_item_price_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_price" ADD CONSTRAINT "menu_item_price_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
