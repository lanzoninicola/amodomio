/*
  Warnings:

  - Added the required column `bairro_id` to the `kds_orders_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_f` to the `kds_orders_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_i` to the `kds_orders_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_m` to the `kds_orders_details` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qty_p` to the `kds_orders_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "kds_orders_details" ADD COLUMN     "bairro_id" TEXT NOT NULL,
ADD COLUMN     "qty_f" INTEGER NOT NULL,
ADD COLUMN     "qty_i" INTEGER NOT NULL,
ADD COLUMN     "qty_m" INTEGER NOT NULL,
ADD COLUMN     "qty_p" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "kds_orders_details" ADD CONSTRAINT "kds_orders_details_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
