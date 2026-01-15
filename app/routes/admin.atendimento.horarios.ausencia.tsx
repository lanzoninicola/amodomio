import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { STORE_OPENING_CONTEXT } from "~/domain/store-opening/store-opening-settings";

type LoaderData = {
  enabled: boolean;
  message: string;
  responseType: "text" | "video";
  video: string;
  caption: string;
};

export async function loader({}: LoaderFunctionArgs) {
  const settings = await settingPrismaEntity.findAllByContext(STORE_OPENING_CONTEXT);
  const byName = new Map(settings.map((setting) => [setting.name, setting.value]));
  const responseTypeRaw = (byName.get("off-hours-response-type") || "text").toLowerCase();
  const responseType = responseTypeRaw === "video" ? "video" : "text";

  return json<LoaderData>({
    enabled: (byName.get("off-hours-enabled") ?? "true") === "true",
    message: byName.get("off-hours-message") || "Estamos fora do horário. Voltamos em breve! 🍕",
    responseType,
    video: byName.get("off-hours-video") || "",
    caption: byName.get("off-hours-video-caption") || "",
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
  const enabled = form.get("off-hours-enabled") === "on";
  const responseTypeRaw = String(form.get("off-hours-response-type") || "text").toLowerCase();
  const responseType = responseTypeRaw === "video" ? "video" : "text";
  const message = String(form.get("off-hours-message") || "");
  const video = String(form.get("off-hours-video") || "");
  const caption = String(form.get("off-hours-video-caption") || "");

  await upsertSetting("off-hours-enabled", String(enabled), "boolean");
  await upsertSetting("off-hours-response-type", responseType, "string");
  await upsertSetting("off-hours-message", message, "string");
  await upsertSetting("off-hours-video", video, "string");
  await upsertSetting("off-hours-video-caption", caption, "string");

  return redirect("/admin/atendimento/horarios/ausencia");
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

export default function AtendimentoHorariosAusencia() {
  const { enabled, message, responseType, video, caption } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";

  const [enabledValue, setEnabledValue] = useState(enabled);
  const [responseTypeValue, setResponseTypeValue] = useState<"text" | "video">(responseType);
  const [messageValue, setMessageValue] = useState(message);
  const [videoValue, setVideoValue] = useState(video);
  const [captionValue, setCaptionValue] = useState(caption);

  const renderWhatsappPreview = useMemo(() => {
    const escape = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const wa = toWhatsappFormatting(messageValue || "");
    return { __html: escape(wa).replace(/\n/g, "<br />") };
  }, [messageValue]);

  return (
    <Form method="post" className="rounded-xl border bg-background/70 p-4 shadow-sm">
      <input type="hidden" name="off-hours-enabled" value={enabledValue ? "on" : "off"} />
      <input type="hidden" name="off-hours-response-type" value={responseTypeValue} />
      <input type="hidden" name="off-hours-message" value={messageValue} />
      <input type="hidden" name="off-hours-video" value={videoValue} />
      <input type="hidden" name="off-hours-video-caption" value={captionValue} />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <Label htmlFor="off-hours-enabled">Ativar mensagem de ausência</Label>
          <p className="text-xs text-muted-foreground">Enviar resposta quando estiver fechado.</p>
        </div>
        <Button type="submit" disabled={isSubmitting} className="px-5">
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg border bg-background/60 px-4 py-3">
        <div>
          <Label htmlFor="off-hours-enabled-toggle">Ativo</Label>
          <p className="text-xs text-muted-foreground">Ligado para responder fora do horário.</p>
        </div>
        <Switch
          id="off-hours-enabled-toggle"
          checked={enabledValue}
          onCheckedChange={setEnabledValue}
        />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label htmlFor="off-hours-response-type">Tipo de mensagem</Label>
          <Select
            value={responseTypeValue}
            onValueChange={(value) => setResponseTypeValue(value as "text" | "video")}
          >
            <SelectTrigger id="off-hours-response-type">
              <SelectValue placeholder="Escolha o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {responseTypeValue === "video" && (
          <>
            <div className="md:col-span-2">
              <Label htmlFor="off-hours-video">URL/Base64 do vídeo</Label>
              <Input
                id="off-hours-video"
                placeholder="https://... ou data:video/mp4;base64,..."
                value={videoValue}
                onChange={(e) => setVideoValue(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="off-hours-video-caption">Legenda (opcional)</Label>
              <Input
                id="off-hours-video-caption"
                placeholder="Legenda do vídeo"
                value={captionValue}
                onChange={(e) => setCaptionValue(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {responseTypeValue === "text" && (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Suporta formatação estilo WhatsApp: *negrito*, _itálico_, monospace sem formatação.</span>
            <span className="text-[11px]">Preview (como será enviado)</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="off-hours-message">Mensagem de ausência</Label>
              <Textarea
                id="off-hours-message"
                className="min-h-[240px] font-mono"
                value={messageValue}
                onChange={(e) => setMessageValue(e.target.value)}
                placeholder="Mensagem enviada fora do horário"
              />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed h-full">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Preview</p>
              <div
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={renderWhatsappPreview}
              />
            </div>
          </div>
        </>
      )}
    </Form>
  );
}
