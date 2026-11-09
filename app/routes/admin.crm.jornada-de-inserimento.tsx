import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import prisma from "~/lib/prisma/client.server";
import capitalize from "~/utils/capitalize";

type DayEntry = {
  ymd: string;
  weekdayLabel: string;
  dateLabel: string;
  count: number;
  isClosed: boolean;
  metGoal: boolean;
};

type LoaderData = {
  monthValue: string;
  monthLabel: string;
  goal: number;
  totals: {
    goal: number;
    inserted: number;
    remaining: number;
  };
  days: DayEntry[];
};

const DEFAULT_DAILY_GOAL = 10;
const SETTINGS_CONTEXT = "crm_jornada_de_inserimento";
const SETTINGS_NAME = "daily_goal";

function formatYmd(year: number, monthIndex: number, day: number) {
  const yy = String(year).padStart(4, "0");
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getMonthValue(raw: string | null, fallback: Date) {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}`;
}

export const meta: MetaFunction = () => [{ title: "CRM - Relatório de clientes" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const monthValue = getMonthValue(url.searchParams.get("month"), new Date());
  const [yearStr, monthStr] = monthValue.split("-");
  const parsedYear = Number(yearStr);
  const parsedMonth = Number(monthStr);
  const now = new Date();
  const year = Number.isFinite(parsedYear) ? parsedYear : now.getFullYear();
  const safeMonth = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1;
  const monthIndex = safeMonth - 1;
  const normalizedMonthValue = `${year}-${String(safeMonth).padStart(2, "0")}`;

  const settingsRow = await prisma.setting.findFirst({
    where: { context: SETTINGS_CONTEXT, name: SETTINGS_NAME },
  });
  const parsedGoal = settingsRow ? Number(settingsRow.value) : NaN;
  const goal = Number.isFinite(parsedGoal) && parsedGoal >= 0 ? Math.floor(parsedGoal) : DEFAULT_DAILY_GOAL;

  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1, 0, 0, 0);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  const customers = await prisma.crmCustomer.findMany({
    where: { created_at: { gte: monthStart, lt: nextMonthStart } },
    select: { created_at: true },
  });

  const countsByDay = new Map<string, number>();
  for (const customer of customers) {
    const created = customer.created_at;
    const ymd = formatYmd(created.getFullYear(), created.getMonth(), created.getDate());
    countsByDay.set(ymd, (countsByDay.get(ymd) || 0) + 1);
  }

  const days: DayEntry[] = Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const ymd = formatYmd(year, monthIndex, day);
    const date = new Date(year, monthIndex, day, 12, 0, 0);
    const weekdayRaw = date.toLocaleDateString("pt-BR", { weekday: "long" });
    const weekdayLabel = capitalize(weekdayRaw.replace("-feira", ""));
    const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const weekdayIndex = date.getDay();
    const isClosed = weekdayIndex === 1 || weekdayIndex === 2;
    const count = countsByDay.get(ymd) ?? 0;

    return {
      ymd,
      weekdayLabel,
      dateLabel,
      count,
      isClosed,
      metGoal: count >= goal,
    };
  });

  const monthLabel = new Date(year, monthIndex, 1, 12).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const totalInserted = days.reduce((sum, day) => sum + day.count, 0);
  const totalOpenDays = days.filter((day) => !day.isClosed).length;
  const totalGoal = totalOpenDays * goal;
  const totalRemaining = Math.max(0, totalGoal - totalInserted);

  return json<LoaderData>({
    monthValue: normalizedMonthValue,
    monthLabel,
    goal,
    totals: {
      goal: totalGoal,
      inserted: totalInserted,
      remaining: totalRemaining,
    },
    days,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const form = await request.formData();
  const intent = String(form.get("_action") || "");

  if (intent !== "saveGoal") {
    return json({ error: "invalid_action" }, { status: 400 });
  }

  const rawGoal = String(form.get("goal") || "");
  const parsedGoal = Number(rawGoal);
  const goal = Number.isFinite(parsedGoal) && parsedGoal >= 0 ? Math.floor(parsedGoal) : DEFAULT_DAILY_GOAL;

  const existing = await prisma.setting.findFirst({
    where: { context: SETTINGS_CONTEXT, name: SETTINGS_NAME },
  });

  if (existing?.id) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { type: "number", value: String(goal) },
    });
  } else {
    await prisma.setting.create({
      data: {
        context: SETTINGS_CONTEXT,
        name: SETTINGS_NAME,
        type: "number",
        value: String(goal),
        createdAt: new Date(),
      },
    });
  }

  const url = new URL(request.url);
  return redirect(url.pathname + url.search);
}

export default function CrmCustomersReportRoute() {
  const { monthValue, monthLabel, goal, totals, days } = useLoaderData<typeof loader>();
  const half = Math.ceil(days.length / 2);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Jornada de inserimentos</h2>
          <p className="text-sm text-muted-foreground">
            Meta: <span className="font-semibold text-foreground">{goal} cadastros/dia</span>
          </p>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Meta do mês: <span className="font-semibold text-foreground">{totals.goal}</span>
            </span>
            <span>
              Inserimentos: <span className="font-semibold text-foreground">{totals.inserted}</span>
            </span>
            <span>
              Falta: <span className="font-semibold text-foreground">{totals.remaining}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Form method="get" className="flex items-end gap-2">
            <div className="grid gap-1">
              <label htmlFor="month" className="text-xs font-medium text-muted-foreground">
                Mês
              </label>
              <Input id="month" type="month" name="month" defaultValue={monthValue} className="w-[160px]" />
            </div>
            <Button type="submit" variant="secondary">
              Aplicar
            </Button>
          </Form>
          <Form method="post" className="flex items-end gap-2">
            <div className="grid gap-1">
              <label htmlFor="goal" className="text-xs font-medium text-muted-foreground">
                Meta diária
              </label>
              <Input
                id="goal"
                type="number"
                name="goal"
                min={0}
                step={1}
                defaultValue={goal}
                className="w-[120px]"
              />
            </div>
            <Button type="submit" name="_action" value="saveGoal" variant="default">
              Salvar
            </Button>
          </Form>
        </div>
      </header>

      <div className="grid gap-10 md:grid-cols-2">
        <DayColumn days={days.slice(0, half)} />
        <DayColumn days={days.slice(half)} />
      </div>
    </div>
  );
}

function DayColumn({ days }: { days: DayEntry[] }) {
  return (
    <div className="grid gap-0">
      {days.map((day) => {
        const statusClass = day.metGoal ? "text-emerald-600" : "text-red-500";
        const dotClass = day.metGoal ? "border-emerald-500 bg-emerald-100" : "border-red-500 bg-red-100";
        const isMuted = day.isClosed && day.count === 0;

        return (
          <div
            key={day.ymd}
            className="grid min-h-[56px] grid-cols-[96px_1fr] items-center gap-x-6 border-b border-muted-foreground/30 py-3 last:border-b-0"
          >
            <div
              className={cn(
                "whitespace-nowrap text-right text-sm leading-tight",
                day.isClosed ? "text-muted-foreground" : "text-foreground"
              )}
            >
              <div className="font-medium">{day.weekdayLabel}</div>
              <div className="text-xs">{day.dateLabel}</div>
            </div>
            <div className="border-l border-foreground/20 pl-6">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    isMuted ? "border-muted-foreground/50 bg-muted" : dotClass
                  )}
                />
                <span className={cn("text-sm font-medium", isMuted ? "text-muted-foreground" : statusClass)}>
                  {day.count} {day.count === 1 ? "inserimento" : "inserimentos"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
