-- Track when a menu-engineering analysis last applied an ItemTag link.
ALTER TABLE "item_tags"
ADD COLUMN "menu_engineering_linked_at" TIMESTAMP(3);
