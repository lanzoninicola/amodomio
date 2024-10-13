/*
  Warnings:

  - You are about to drop the `import_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `imports` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "import_records" DROP CONSTRAINT "import_records_import_id_fkey";

-- DropForeignKey
ALTER TABLE "imports" DROP CONSTRAINT "imports_import_profile_id_fkey";

-- DropTable
DROP TABLE "import_records";

-- DropTable
DROP TABLE "imports";

-- CreateTable
CREATE TABLE "import_data" (
    "id" TEXT NOT NULL,
    "import_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_data_records" (
    "id" TEXT NOT NULL,
    "import_data_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_data_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "import_data" ADD CONSTRAINT "import_data_import_profile_id_fkey" FOREIGN KEY ("import_profile_id") REFERENCES "import_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_data_records" ADD CONSTRAINT "import_data_records_import_data_id_fkey" FOREIGN KEY ("import_data_id") REFERENCES "import_data"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
