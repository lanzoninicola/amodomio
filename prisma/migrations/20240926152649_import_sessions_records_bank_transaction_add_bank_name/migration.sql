/*
  Warnings:

  - Added the required column `bank_name` to the `banks_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bank_name` to the `import_sessions_records_banks_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "banks_transactions" ADD COLUMN     "bank_name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "import_sessions_records_banks_transactions" ADD COLUMN     "bank_name" TEXT NOT NULL;
