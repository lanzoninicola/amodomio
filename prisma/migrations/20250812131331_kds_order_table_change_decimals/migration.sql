/*
  Warnings:

  - You are about to alter the column `moto_value` on the `kds_daily_order_details` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `order_amount` on the `kds_daily_order_details` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `tot_orders_amount` on the `kds_daily_orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "kds_daily_order_details" ALTER COLUMN "moto_value" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "order_amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "kds_daily_orders" ALTER COLUMN "tot_orders_amount" SET DATA TYPE DECIMAL(10,2);
