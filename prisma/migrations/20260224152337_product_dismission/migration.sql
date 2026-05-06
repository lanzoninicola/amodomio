-- AlterTable
ALTER TABLE "items" ADD COLUMN     "category_id" TEXT;

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "items"("category_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
