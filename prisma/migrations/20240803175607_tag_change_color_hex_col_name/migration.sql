/*
  Warnings:

  - You are about to drop the column `colorHEX` on the `tags` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tags" DROP COLUMN "colorHEX",
ADD COLUMN     "color_hex" TEXT NOT NULL DEFAULT '#000000';
