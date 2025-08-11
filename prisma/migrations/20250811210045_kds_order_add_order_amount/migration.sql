/*
  Warnings:

  - Added the required column `order_amount` to the `kds_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "kds_orders" ADD COLUMN     "order_amount" DECIMAL(10,2) NOT NULL;
