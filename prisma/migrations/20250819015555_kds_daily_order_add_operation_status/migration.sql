/*
  Warnings:

  - You are about to drop the column `is_closed` on the `kds_daily_orders` table. All the data in the column will be lost.
  - You are about to drop the column `is_open` on the `kds_daily_orders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "kds_daily_orders" DROP COLUMN "is_closed",
DROP COLUMN "is_open",
ADD COLUMN     "operation_status" TEXT DEFAULT 'pending';
