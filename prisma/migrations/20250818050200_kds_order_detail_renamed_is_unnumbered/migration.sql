/*
  Warnings:

  - You are about to drop the column `is_unnumbered` on the `kds_daily_order_details` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "kds_daily_order_details" DROP COLUMN "is_unnumbered",
ADD COLUMN     "is_venda_livre" BOOLEAN NOT NULL DEFAULT false;
