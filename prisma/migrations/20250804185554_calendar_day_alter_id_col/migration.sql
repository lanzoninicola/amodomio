/*
  Warnings:

  - The primary key for the `CalendarDay` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "CalendarDay" DROP CONSTRAINT "CalendarDay_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "CalendarDay_id_seq";
