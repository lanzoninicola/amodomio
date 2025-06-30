/*
  Warnings:

  - You are about to drop the column `ofx` on the `import_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "import_profiles" DROP COLUMN "ofx",
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'csv';
