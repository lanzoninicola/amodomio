import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";

const CONTEXT = "bot-off-hours-autoresponder";
const DEFAULTS = {
  enabled: true,
  days: [0, 1, 2, 3, 4, 5, 6],
  message: "Estamos fora do horário. Voltamos em breve! 🍕",
};

const WEEK_DAYS = [
  { day: 1, label: "segunda-feira" },
  { day: 2, label: "terça-feira" },
  { day: 3, label: "quarta-feira" },
  { day: 4, label: "quinta-feira" },
  { day: 5, label: "sexta-feira" },
  { day: 6, label: "sábado" },
  { day: 0, label: "domingo" },
];

type LoaderData = {
  enabled: boolean;
  days: number[];
  message: string;
};

export async function loader({}: LoaderFunctionArgs) {
  const settings = await settingPrismaEntity.findAllByContext(CONTEXT);
  const byName = new Map(settings.map((setting) => [setting.name, setting.value]));

  const daysRaw = byName.get("days");
  const days = daysRaw
    ? daysRaw.split(",").map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : DEFAULTS.days;

  const data: LoaderData = {
    enabled: (byName.get("enabled") ?? String(DEFAULTS.enabled)) === "true",
    days,
    message: byName.get("message") || DEFAULTS.message,
  };

  return json({ data });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const enabled = form.get("enabled") === "on";
  const message = String(form.get("message") || DEFAULTS.message);

  const selectedDays = WEEK_DAYS.filter((weekday) => form.get(`day-${weekday.day}`) === "on")
    .map((weekday) => weekday.day)
    .sort((a, b) => a - b);

  const daysValue = selectedDays.length ? selectedDays.join(",") : DEFAULTS.days.join(",");

  const updates = [
    { name: "enabled", value: String(enabled), type: "boolean" },
    { name: "days", value: daysValue, type: "string" },
    { name: "message", value: message, type: "string" },
  ];

  for (const entry of updates) {
    const existing = await settingPrismaEntity.findByContextAndName(CONTEXT, entry.name);
    if (existing?.id) {
      await settingPrismaEntity.update(existing.id, { value: entry.value, type: entry.type });
      continue;
    }

    await settingPrismaEntity.create({
      context: CONTEXT,
      name: entry.name,
      type: entry.type,
      value: entry.value,
      createdAt: new Date(),
    });
  }

  return redirect("/admin/bot/auto-responder/settings");
}

function toWhatsappFormatting(value: string) {
  if (!value) return "";
  let text = value;
  text = text.replace(/\*\*(.+?)\*\*/g, "*$1*"); // bold
  text = text.replace(/__(.+?)__/g, "_$1_"); // italic style alt
  text = text.replace(/_(.+?)_/g, "_$1_"); // italic
  text = text.replace(/```([\s\S]+?)```/g, "$1"); // triple backtick to plain
  text = text.replace(/`(.+?)`/g, "$1"); // inline code to plain
  return text;
}

export default function SettingsPage() {
  const { data } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const [messagePreview, setMessagePreview] = useState(data.message);

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

  const selectedDays = useMemo(() => new Set(data.days), [data.days]);

  return (
    <Form method="post" className="font-neue">
      <div className="mb-8 space-y-3 rounded-xl bg-gradient-to-br from-muted/60 via-background to-muted/30 p-6 border border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">BOT / HORÁRIOS</p>
            <h1 className="text-3xl font-semibold">Auto-responder fora do horário</h1>
            <p className="text-sm text-muted-foreground">
              Envie mensagens automáticas quando o atendimento estiver fechado.
            </p>
          </div>
          <Button type="submit" disabled={isSubmitting} className="px-5">
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="col-span-1 flex items-center justify-between rounded-lg border bg-background/60 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div>
              <Label htmlFor="enabled">Ativar</Label>
              <p className="text-xs text-muted-foreground">Enviar resposta fora do horário.</p>
            </div>
            <Switch id="enabled" name="enabled" defaultChecked={data.enabled} />
          </div>

          <div className="md:col-span-3">
            <Label>Dias com resposta fora do horário</Label>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {WEEK_DAYS.map((weekday) => (
                <label key={weekday.day} className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name={`day-${weekday.day}`}
                    defaultChecked={selectedDays.has(weekday.day)}
                    className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="capitalize">{weekday.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-background/70 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Suporta formatação estilo WhatsApp: *negrito*, _itálico_, monospace sem formatação.</span>
          <span className="text-[11px]">Preview (como será enviado)</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem de ausência</Label>
            <Textarea
              id="message"
              name="message"
              className="min-h-[240px] font-mono"
              value={messagePreview}
              onChange={(e) => setMessagePreview(e.target.value)}
              placeholder="Mensagem enviada fora do horário"
            />
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed h-full">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Preview</p>
            <div
              className="whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={renderWhatsappPreview(`${messagePreview}`)}
            />
          </div>
        </div>
      </div>
    </Form>
  );
}
