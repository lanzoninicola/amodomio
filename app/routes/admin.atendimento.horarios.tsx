import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import {
  buildRangeDigitsFromNumbers,
  buildStoreOpeningSchedule,
  DEFAULT_STORE_OPENING,
  formatRangeDigits,
  normalizeRangeDigits,
  STORE_OPENING_CONTEXT,
} from "~/domain/store-opening/store-opening-settings";
import { cn } from "~/lib/utils";

const WEEK_DAYS = [
  { day: 1, label: "segunda-feira" },
  { day: 2, label: "terça-feira" },
  { day: 3, label: "quarta-feira" },
  { day: 4, label: "quinta-feira" },
  { day: 5, label: "sexta-feira" },
  { day: 6, label: "sábado" },
  { day: 0, label: "domingo" },
];

type LoaderDay = {
  day: number;
  label: string;
  enabled: boolean;
  rangeDigits: string;
};

type LoaderData = {
  days: LoaderDay[];
};

export const meta: MetaFunction = () => [
  { title: "Horários de Atendimento | Admin" },
  { name: "robots", content: "noindex" },
];

function getFallbackConfig() {
  const fallbackOpenDays = DEFAULT_STORE_OPENING.openDays;
  const fallbackStart = DEFAULT_STORE_OPENING.start;
  const fallbackEnd = DEFAULT_STORE_OPENING.end;
  const fallbackRange = buildRangeDigitsFromNumbers(fallbackStart, fallbackEnd);

  return {
    fallbackOpenDays,
    fallbackStart,
    fallbackEnd,
    fallbackRange,
  };
}

export async function loader({}: LoaderFunctionArgs) {
  const { fallbackOpenDays, fallbackStart, fallbackEnd, fallbackRange } = getFallbackConfig();
  const settings = await settingPrismaEntity.findAllByContext(STORE_OPENING_CONTEXT);
  const settingsMap = new Map(settings.map((setting) => [setting.name, setting.value]));
  const schedule = buildStoreOpeningSchedule({
    settings: settingsMap,
    fallbackOpenDays,
    fallbackStart,
    fallbackEnd,
  });
  const scheduleByDay = new Map(schedule.map((item) => [item.day, item]));

  const days = WEEK_DAYS.map((weekday) => {
    const entry = scheduleByDay.get(weekday.day);
    return {
      day: weekday.day,
      label: weekday.label,
      enabled: entry?.enabled ?? false,
      rangeDigits: entry?.rangeDigits ?? fallbackRange,
    };
  });

  return json<LoaderData>({ days });
}

async function upsertSetting(name: string, value: string, type: string) {
  const existing = await settingPrismaEntity.findByContextAndName(
    STORE_OPENING_CONTEXT,
    name
  );

  if (existing?.id) {
    await settingPrismaEntity.update(existing.id, { value, type });
    return;
  }

  await settingPrismaEntity.create({
    context: STORE_OPENING_CONTEXT,
    name,
    type,
    value,
    createdAt: new Date(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const { fallbackRange } = getFallbackConfig();

  for (const weekday of WEEK_DAYS) {
    const enabledName = `day-${weekday.day}-enabled`;
    const rangeName = `day-${weekday.day}-range`;

    const enabled = form.get(enabledName) === "on";
    const rawRange = String(form.get(rangeName) || "");
    const rangeDigits = normalizeRangeDigits(rawRange, fallbackRange);

    await upsertSetting(enabledName, String(enabled), "boolean");
    await upsertSetting(rangeName, rangeDigits, "string");
  }

  return redirect("/admin/atendimento/horarios");
}

export default function AtendimentoHorariosPage() {
  const { days } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";

  const [enabledByDay, setEnabledByDay] = useState(() =>
    days.reduce<Record<number, boolean>>((acc, item) => {
      acc[item.day] = item.enabled;
      return acc;
    }, {})
  );
  const [rangeByDay, setRangeByDay] = useState(() =>
    days.reduce<Record<number, string>>((acc, item) => {
      acc[item.day] = item.rangeDigits;
      return acc;
    }, {})
  );

  const formattedRanges = useMemo(() => {
    return Object.fromEntries(
      days.map((item) => [item.day, formatRangeDigits(rangeByDay[item.day] ?? "")])
    );
  }, [days, rangeByDay]);

  return (
    <Form method="post" className="font-neue">
      <div className="mb-8 space-y-3 rounded-xl border bg-muted/40 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Atendimento
            </p>
            <h1 className="text-3xl font-semibold">Horários de atendimento</h1>
            <p className="text-sm text-muted-foreground">
              Configure os horários de funcionamento. Usamos esses horários para abrir e
              fechar a loja automaticamente.
            </p>
          </div>
          <Button type="submit" disabled={isSubmitting} className="px-5">
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">O que você precisa?</p>
          <p>- Ficar aberto pelo menos um dia na semana</p>
          <p>- Abrir no mínimo duas horas no dia</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Digite números consecutivos, exemplo: <span className="font-mono">19002200</span>
          {" "}vira <span className="font-mono">19:00 - 22:00</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {days.map((weekday) => {
          const enabled = enabledByDay[weekday.day];
          const rangeName = `day-${weekday.day}-range`;
          const checkboxId = `day-${weekday.day}-enabled`;

          return (
            <div
              key={weekday.day}
              className="flex items-center justify-between rounded-lg border bg-background px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <input
                  id={checkboxId}
                  name={checkboxId}
                  type="checkbox"
                  defaultChecked={weekday.enabled}
                  className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) =>
                    setEnabledByDay((prev) => ({
                      ...prev,
                      [weekday.day]: event.target.checked,
                    }))
                  }
                />
                <Label htmlFor={checkboxId} className="capitalize">
                  {weekday.label}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="hidden"
                  name={rangeName}
                  value={rangeByDay[weekday.day] ?? ""}
                />
                <Input
                  id={rangeName}
                  inputMode="numeric"
                  autoComplete="off"
                  value={formattedRanges[weekday.day] ?? ""}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
                    setRangeByDay((prev) => ({ ...prev, [weekday.day]: digits }));
                  }}
                  readOnly={!enabled}
                  placeholder="18:00 - 22:00"
                  className={cn(
                    "w-[150px] text-center font-mono",
                    !enabled && "text-muted-foreground"
                  )}
                />
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md border",
                    !enabled && "text-muted-foreground"
                  )}
                >
                  <Clock className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Form>
  );
}
