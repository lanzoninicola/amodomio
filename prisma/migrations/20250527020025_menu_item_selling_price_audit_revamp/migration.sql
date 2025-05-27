/*
  Warnings:

  - You are about to drop the column `menu_item_selling_price_variation_id` on the `menu_item_selling_prices_audit` table. All the data in the column will be lost.
  - Added the required column `menu_item_id` to the `menu_item_selling_prices_audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `menu_item_selling_channel_id` to the `menu_item_selling_prices_audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `menu_item_size_id` to the `menu_item_selling_prices_audit` table without a default value. This is not possible if the table is not empty.
  - Made the column `updated_by` on table `menu_item_selling_prices_audit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "menu_item_selling_prices_audit" DROP CONSTRAINT "menu_item_selling_prices_audit_menu_item_selling_price_var_fkey";

-- AlterTable
ALTER TABLE "menu_item_selling_prices_audit" DROP COLUMN "menu_item_selling_price_variation_id",
ADD COLUMN     "menu_item_id" TEXT NOT NULL,
ADD COLUMN     "menu_item_selling_channel_id" TEXT NOT NULL,
ADD COLUMN     "menu_item_size_id" TEXT NOT NULL,
ALTER COLUMN "updated_by" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices_audit" ADD CONSTRAINT "menu_item_selling_prices_audit_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices_audit" ADD CONSTRAINT "menu_item_selling_prices_audit_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices_audit" ADD CONSTRAINT "menu_item_selling_prices_audit_menu_item_selling_channel_i_fkey" FOREIGN KEY ("menu_item_selling_channel_id") REFERENCES "menu_item_selling_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
