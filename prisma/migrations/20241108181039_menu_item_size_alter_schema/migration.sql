/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `menu_item_sizes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "menu_item_sizes_slug_key" ON "menu_item_sizes"("slug");
