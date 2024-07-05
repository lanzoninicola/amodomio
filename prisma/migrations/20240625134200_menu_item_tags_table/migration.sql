/*
  Warnings:

  - You are about to drop the column `featured` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `is_vegetarian` on the `menu_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "featured",
DROP COLUMN "is_vegetarian";

-- CreateTable
CREATE TABLE "menu_item_tags" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "tag" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_tags_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_tags" ADD CONSTRAINT "menu_item_tags_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
