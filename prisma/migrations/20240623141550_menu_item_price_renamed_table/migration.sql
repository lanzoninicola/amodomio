/*
  Warnings:

  - You are about to drop the `menu_item_price` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "menu_item_price" DROP CONSTRAINT "menu_item_price_menu_item_id_fkey";

-- DropTable
DROP TABLE "menu_item_price";

-- CreateTable
CREATE TABLE "menu_item_price_variations" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_price_variations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_price_variations" ADD CONSTRAINT "menu_item_price_variations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
