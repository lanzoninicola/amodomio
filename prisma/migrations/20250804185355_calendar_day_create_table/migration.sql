-- CreateTable
CREATE TABLE "CalendarDay" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dateInt" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_date_key" ON "CalendarDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_dateInt_key" ON "CalendarDay"("dateInt");
