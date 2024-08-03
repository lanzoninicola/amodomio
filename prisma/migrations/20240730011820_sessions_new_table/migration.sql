/*
  Warnings:

  - You are about to drop the column `sessionId` on the `menu_item_likes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "menu_item_likes" DROP COLUMN "sessionId",
ADD COLUMN     "session_id" TEXT;

-- CreateTable
CREATE TABLE "Sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "payload" TEXT,

    CONSTRAINT "Sessions_pkey" PRIMARY KEY ("id")
);
