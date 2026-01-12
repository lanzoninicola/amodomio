/*
  Warnings:

  - The primary key for the `meta_ads_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "meta_ads_logs" DROP CONSTRAINT "meta_ads_logs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "meta_ads_logs_pkey" PRIMARY KEY ("id");
