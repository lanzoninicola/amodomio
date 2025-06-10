/*
  Warnings:

  - Added the required column `function_id` to the `hr_job_openings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "hr_job_openings" ADD COLUMN     "function_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "hr_job_functions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "hr_job_functions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "hr_job_openings" ADD CONSTRAINT "hr_job_openings_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "hr_job_functions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
