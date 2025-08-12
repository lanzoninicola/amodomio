/*
  Warnings:

  - You are about to drop the column `bairro_id` on the `kds_orders` table. All the data in the column will be lost.
  - You are about to drop the column `qty_f` on the `kds_orders` table. All the data in the column will be lost.
  - You are about to drop the column `qty_i` on the `kds_orders` table. All the data in the column will be lost.
  - You are about to drop the column `qty_m` on the `kds_orders` table. All the data in the column will be lost.
  - You are about to drop the column `qty_p` on the `kds_orders` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `kds_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "kds_orders" DROP CONSTRAINT "kds_orders_bairro_id_fkey";

-- DropIndex
DROP INDEX "kds_orders_channel_idx";

-- DropIndex
DROP INDEX "kds_orders_command_number_idx";

-- DropIndex
DROP INDEX "kds_orders_date_int_key";

-- DropIndex
DROP INDEX "kds_orders_date_key";

-- AlterTable
ALTER TABLE "kds_orders" DROP COLUMN "bairro_id",
DROP COLUMN "qty_f",
DROP COLUMN "qty_i",
DROP COLUMN "qty_m",
DROP COLUMN "qty_p",
ADD COLUMN     "bairroId" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "moto_value" SET DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'pendente';

-- CreateIndex
CREATE INDEX "kds_orders_date_int_idx" ON "kds_orders"("date_int");

-- AddForeignKey
ALTER TABLE "kds_orders" ADD CONSTRAINT "kds_orders_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "bairros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
