-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "menu_item_group_id" TEXT;

-- CreateTable
CREATE TABLE "menu_item_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "menu_item_groups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_item_group_id_fkey" FOREIGN KEY ("menu_item_group_id") REFERENCES "menu_item_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
