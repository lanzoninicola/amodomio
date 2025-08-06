/*
  Warnings:

  - You are about to drop the `kds_orders_details` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `bairro_id` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channel` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `command_number` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moto_value` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_f` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_i` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_m` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_p` to the `kds_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `kds_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "kds_orders_details" DROP CONSTRAINT "kds_orders_details_bairro_id_fkey";

-- DropForeignKey
ALTER TABLE "kds_orders_details" DROP CONSTRAINT "kds_orders_details_kds_order_id_fkey";

-- DropIndex
DROP INDEX "kds_orders_date_int_idx";

-- AlterTable
ALTER TABLE "kds_orders" ADD COLUMN     "bairro_id" TEXT NOT NULL,
ADD COLUMN     "channel" TEXT NOT NULL,
ADD COLUMN     "command_number" INTEGER NOT NULL,
ADD COLUMN     "has_moto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moto_value" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "product" TEXT NOT NULL,
ADD COLUMN     "qty_f" INTEGER NOT NULL,
ADD COLUMN     "qty_i" INTEGER NOT NULL,
ADD COLUMN     "qty_m" INTEGER NOT NULL,
ADD COLUMN     "qty_p" INTEGER NOT NULL,
ADD COLUMN     "size" TEXT NOT NULL;

-- DropTable
DROP TABLE "kds_orders_details";

-- CreateIndex
CREATE INDEX "kds_orders_command_number_idx" ON "kds_orders"("command_number");

-- CreateIndex
CREATE INDEX "kds_orders_channel_idx" ON "kds_orders"("channel");

-- AddForeignKey
ALTER TABLE "kds_orders" ADD CONSTRAINT "kds_orders_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
