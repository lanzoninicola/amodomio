/*
  Warnings:

  - You are about to drop the column `hashRecord` on the `banks_transactions` table. All the data in the column will be lost.
  - Added the required column `hash_record` to the `banks_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "banks_transactions" DROP COLUMN "hashRecord",
ADD COLUMN     "hash_record" TEXT NOT NULL;
