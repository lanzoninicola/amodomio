/*
  Warnings:

  - Added the required column `status` to the `kds_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "kds_orders" ADD COLUMN     "status" TEXT NOT NULL;
