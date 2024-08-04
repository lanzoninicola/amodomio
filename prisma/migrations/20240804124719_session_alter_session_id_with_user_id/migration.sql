/*
  Warnings:

  - You are about to drop the column `session_id` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "session_id",
ADD COLUMN     "user_id" TEXT;
