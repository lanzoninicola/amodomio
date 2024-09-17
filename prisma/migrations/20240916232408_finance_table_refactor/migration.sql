/*
  Warnings:

  - You are about to drop the `import_ofx_records` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "import_ofx_records";

-- CreateTable
CREATE TABLE "import_banks_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_banks_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "hashRecord" TEXT NOT NULL,
    "hash_transaction_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banks_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hash_transaction_refs_finance_accounts" (
    "id" TEXT NOT NULL,
    "hash_transaction_ref" TEXT NOT NULL,
    "finance_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hash_transaction_refs_finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "hash_transaction_refs_finance_accounts" ADD CONSTRAINT "hash_transaction_refs_finance_accounts_finance_account_id_fkey" FOREIGN KEY ("finance_account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
