/*
  Warnings:

  - You are about to drop the `CalendarDay` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CalendarDay";

-- CreateTable
CREATE TABLE "calendar_day" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "date_int" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "is_weekend" BOOLEAN NOT NULL DEFAULT false,
    "is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_day_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_day_date_key" ON "calendar_day"("date");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_day_date_int_key" ON "calendar_day"("date_int");
