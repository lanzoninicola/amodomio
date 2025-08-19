/*
  Warnings:

  - You are about to drop the `Feedback` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Feedback";

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentiment" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "text" TEXT,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);
