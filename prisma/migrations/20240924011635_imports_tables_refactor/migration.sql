/*
  Warnings:

  - You are about to drop the `import_banks_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `import_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `import_data_records` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `day` to the `banks_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "import_data" DROP CONSTRAINT "import_data_import_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "import_data_records" DROP CONSTRAINT "import_data_records_import_data_id_fkey";

-- AlterTable
ALTER TABLE "banks_transactions" ADD COLUMN     "day" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "import_profiles" ADD COLUMN     "ofx" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "import_banks_transactions";

-- DropTable
DROP TABLE "import_data";

-- DropTable
DROP TABLE "import_data_records";

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" TEXT NOT NULL,
    "import_profile_id" TEXT,
    "description" TEXT,
    "transformed" BOOLEAN NOT NULL DEFAULT false,
    "loaded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_sessions_records" (
    "id" TEXT NOT NULL,
    "import_session_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sessions_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_sessions_banks_transactions" (
    "id" TEXT NOT NULL,
    "import_session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sessions_banks_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_import_profile_id_fkey" FOREIGN KEY ("import_profile_id") REFERENCES "import_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions_records" ADD CONSTRAINT "import_sessions_records_import_session_id_fkey" FOREIGN KEY ("import_session_id") REFERENCES "import_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions_banks_transactions" ADD CONSTRAINT "import_sessions_banks_transactions_import_session_id_fkey" FOREIGN KEY ("import_session_id") REFERENCES "import_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
