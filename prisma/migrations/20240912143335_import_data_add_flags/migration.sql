-- AlterTable
ALTER TABLE "import_data" ADD COLUMN     "loaded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transformed" BOOLEAN NOT NULL DEFAULT false;
