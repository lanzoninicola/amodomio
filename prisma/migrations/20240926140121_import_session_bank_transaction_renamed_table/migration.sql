/*
  Warnings:

  - You are about to drop the `import_sessions_banks_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "import_sessions_banks_transactions" DROP CONSTRAINT "import_sessions_banks_transactions_import_session_id_fkey";

-- DropTable
DROP TABLE "import_sessions_banks_transactions";

-- CreateTable
CREATE TABLE "import_sessions_records_banks_transactions" (
    "id" TEXT NOT NULL,
    "import_session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sessions_records_banks_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "import_sessions_records_banks_transactions" ADD CONSTRAINT "import_sessions_records_banks_transactions_import_session__fkey" FOREIGN KEY ("import_session_id") REFERENCES "import_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
