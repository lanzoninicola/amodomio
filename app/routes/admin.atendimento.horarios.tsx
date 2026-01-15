import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Clock } from "lucide-react";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import {
  buildRangeDigitsFromNumbers,
  DEFAULT_STORE_OPENING,
  formatRangeDigits,
  normalizeRangeDigits,
  STORE_OPENING_CONTEXT,
} from "~/domain/store-opening/store-opening-settings";
import { loadStoreOpeningSchedule } from "~/domain/store-opening/store-opening-status.server";
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
  offHoursEnabled: boolean;
  offHoursMessage: string;
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
  const { fallbackRange } = getFallbackConfig();
  const schedule = await loadStoreOpeningSchedule();
  const scheduleByDay = new Map(schedule.map((item) => [item.day, item]));
  const settings = await settingPrismaEntity.findAllByContext(STORE_OPENING_CONTEXT);
  const byName = new Map(settings.map((setting) => [setting.name, setting.value]));

  const days = WEEK_DAYS.map((weekday) => {
    const entry = scheduleByDay.get(weekday.day);
    return {
      day: weekday.day,
      label: weekday.label,
      enabled: entry?.enabled ?? false,
      rangeDigits: entry?.rangeDigits ?? fallbackRange,
    };
  });

  return json<LoaderData>({
    days,
    offHoursEnabled: (byName.get("off-hours-enabled") ?? "true") === "true",
    offHoursMessage:
      byName.get("off-hours-message") ||
      "Estamos fora do horário. Voltamos em breve! 🍕",
  });
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
  const offHoursEnabled = form.get("off-hours-enabled") === "on";
  const offHoursMessage = String(form.get("off-hours-message") || "");

  for (const weekday of WEEK_DAYS) {
    const enabledName = `day-${weekday.day}-enabled`;
    const rangeName = `day-${weekday.day}-range`;

    const enabled = form.get(enabledName) === "on";
    const rawRange = String(form.get(rangeName) || "");
    const rangeDigits = normalizeRangeDigits(rawRange, fallbackRange);

    await upsertSetting(enabledName, String(enabled), "boolean");
    await upsertSetting(rangeName, rangeDigits, "string");
  }

  await upsertSetting("off-hours-enabled", String(offHoursEnabled), "boolean");
  await upsertSetting("off-hours-message", offHoursMessage, "string");

  return redirect("/admin/atendimento/horarios");
}

function toWhatsappFormatting(value: string) {
  if (!value) return "";
  let text = value;
  text = text.replace(/\*\*(.+?)\*\*/g, "*$1*");
  text = text.replace(/__(.+?)__/g, "_$1_");
  text = text.replace(/_(.+?)_/g, "_$1_");
  text = text.replace(/```([\s\S]+?)```/g, "$1");
  text = text.replace(/`(.+?)`/g, "$1");
  return text;
}

export default function AtendimentoHorariosPage() {
  const { days, offHoursEnabled, offHoursMessage } = useLoaderData<typeof loader>();
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
  const [absenceMessage, setAbsenceMessage] = useState(offHoursMessage);

  const formattedRanges = useMemo(() => {
    return Object.fromEntries(
      days.map((item) => [item.day, formatRangeDigits(rangeByDay[item.day] ?? "")])
    );
  }, [days, rangeByDay]);

  const renderWhatsappPreview = (value: string) => {
    const escape = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const wa = toWhatsappFormatting(value || "");
    return { __html: escape(wa).replace(/\n/g, "<br />") };
  };

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

      <Tabs defaultValue="hours" className="w-full space-y-4">
        <TabsList className="mb-0 rounded-lg border bg-background/80">
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="offhours">Mensagem de ausência</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
        </TabsContent>

        <TabsContent value="offhours" className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between rounded-lg border bg-background/60 px-4 py-3">
            <div>
              <Label htmlFor="off-hours-enabled">Ativar mensagem de ausência</Label>
              <p className="text-xs text-muted-foreground">Enviar resposta quando estiver fechado.</p>
            </div>
            <Switch id="off-hours-enabled" name="off-hours-enabled" defaultChecked={offHoursEnabled} />
          </div>
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Suporta formatação estilo WhatsApp: *negrito*, _itálico_, monospace sem formatação.</span>
            <span className="text-[11px]">Preview (como será enviado)</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="off-hours-message">Mensagem de ausência</Label>
              <Textarea
                id="off-hours-message"
                name="off-hours-message"
                className="min-h-[240px] font-mono"
                value={absenceMessage}
                onChange={(e) => setAbsenceMessage(e.target.value)}
                placeholder="Mensagem enviada fora do horário"
              />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed h-full">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Preview</p>
              <div
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={renderWhatsappPreview(`${absenceMessage}`)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Form>
  );
}
