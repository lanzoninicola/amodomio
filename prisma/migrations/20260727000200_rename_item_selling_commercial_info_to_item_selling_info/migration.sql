ALTER TABLE "item_selling_commercial_info" RENAME TO "item_selling_info";

ALTER TABLE "item_selling_info"
RENAME CONSTRAINT "item_selling_commercial_info_pkey" TO "item_selling_info_pkey";

ALTER TABLE "item_selling_info"
RENAME CONSTRAINT "item_selling_commercial_info_item_id_fkey" TO "item_selling_info_item_id_fkey";

ALTER TABLE "item_selling_info"
RENAME CONSTRAINT "item_selling_commercial_info_selling_category_id_fkey" TO "item_selling_info_category_id_fkey";

ALTER TABLE "item_selling_info"
RENAME CONSTRAINT "item_selling_commercial_info_menu_item_group_id_fkey" TO "item_selling_info_menu_item_group_id_fkey";

ALTER INDEX "item_selling_commercial_info_item_id_unique"
RENAME TO "item_selling_info_item_id_unique";

ALTER INDEX "item_selling_commercial_info_category_id_idx"
RENAME TO "item_selling_info_category_id_idx";

ALTER INDEX "item_selling_commercial_info_group_id_idx"
RENAME TO "item_selling_info_group_id_idx";

ALTER TABLE "item_selling_info"
RENAME COLUMN "selling_category_id" TO "category_id";
