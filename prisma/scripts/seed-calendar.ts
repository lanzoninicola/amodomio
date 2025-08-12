import prismaClient from "~/lib/prisma/client.server";

function getWeekday(date: Date): number {
  return date.getDay(); // 0=Domingo
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function toDateInt(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return Number(`${y}${m}${d}`);
}

async function main() {
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2030-12-31");

  const days: {
    date: Date;
    dateInt: number;
    year: number;
    month: number;
    day: number;
    weekday: number;
    isWeekend: boolean;
  }[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push({
      date: new Date(d),
      dateInt: toDateInt(d),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday: getWeekday(d),
      isWeekend: isWeekend(d),
    });
  }

  await prismaClient.calendarDay.createMany({
    data: days,
    skipDuplicates: true,
  });

  console.log("Calendar days populated with dateInt (2025–2030)");
}

main().finally(() => prismaClient.$disconnect());
