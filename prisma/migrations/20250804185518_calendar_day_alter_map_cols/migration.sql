/*
  Warnings:

  - You are about to drop the column `createdAt` on the `CalendarDay` table. All the data in the column will be lost.
  - You are about to drop the column `dateInt` on the `CalendarDay` table. All the data in the column will be lost.
  - You are about to drop the column `isHoliday` on the `CalendarDay` table. All the data in the column will be lost.
  - You are about to drop the column `isWeekend` on the `CalendarDay` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[date_int]` on the table `CalendarDay` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date_int` to the `CalendarDay` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CalendarDay_dateInt_key";

-- AlterTable
ALTER TABLE "CalendarDay" DROP COLUMN "createdAt",
DROP COLUMN "dateInt",
DROP COLUMN "isHoliday",
DROP COLUMN "isWeekend",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date_int" INTEGER NOT NULL,
ADD COLUMN     "is_holiday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_weekend" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_date_int_key" ON "CalendarDay"("date_int");
