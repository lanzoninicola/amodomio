/*
  Warnings:

  - You are about to drop the `hr_job_opening_descriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "hr_job_opening_descriptions" DROP CONSTRAINT "hr_job_opening_descriptions_job_opening_id_fkey";

-- AlterTable
ALTER TABLE "hr_job_openings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "finance_proposal_by_consultant" TEXT,
ADD COLUMN     "finance_proposal_to_offer" TEXT,
ADD COLUMN     "note" TEXT;

-- DropTable
DROP TABLE "hr_job_opening_descriptions";
