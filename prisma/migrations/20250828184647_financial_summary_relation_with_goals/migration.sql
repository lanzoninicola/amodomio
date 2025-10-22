/*
  Warnings:

  - You are about to drop the column `description` on the `financial_daily_goals` table. All the data in the column will be lost.
  - You are about to drop the column `is_snapshot` on the `financial_daily_goals` table. All the data in the column will be lost.
  - Added the required column `financial_summary_id` to the `financial_daily_goals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "financial_daily_goals" DROP COLUMN "description",
DROP COLUMN "is_snapshot",
ADD COLUMN     "financial_summary_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "financial_daily_goals" ADD CONSTRAINT "financial_daily_goals_financial_summary_id_fkey" FOREIGN KEY ("financial_summary_id") REFERENCES "financial_summaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
