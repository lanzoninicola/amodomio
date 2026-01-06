import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { getTrafficAutoresponderContext } from "~/domain/z-api/meta-auto-responder.server";

type LoaderData = {
  enabled: boolean;
  trigger: string;
  menuUrl: string;
  responseType: "text" | "buttons";
  textMessage: string;
  buttonMessage: string;
  menuButtonText: string;
  sizesButtonText: string;
};

const CONTEXT = getTrafficAutoresponderContext();
const DEFAULTS: LoaderData = {
  enabled: true,
  trigger: "ads",
  menuUrl: "https://amodomio.com.br/cardapio",
  responseType: "text",
  textMessage:
    "Oi! Eu sou do A Modo Mio. Queremos te ajudar rapido. Segue o cardapio e infos:",
  buttonMessage:
    "Oi! Eu sou do A Modo Mio. Queremos te ajudar rapido. Escolha uma opcao abaixo:",
  menuButtonText: "Ver o nosso cardapio",
  sizesButtonText: "Informacoes sobre tamanhos",
};

export async function loader({}: LoaderFunctionArgs) {
  const settings = await settingPrismaEntity.findAllByContext(CONTEXT);
  const byName = new Map(settings.map((s) => [s.name, s.value]));

  const data: LoaderData = {
    enabled: (byName.get("enabled") ?? String(DEFAULTS.enabled)) === "true",
    trigger: byName.get("trigger") || DEFAULTS.trigger,
    menuUrl: byName.get("menuUrl") || DEFAULTS.menuUrl,
    responseType: (byName.get("responseType") as "text" | "buttons") || DEFAULTS.responseType,
    textMessage: byName.get("textMessage") || byName.get("message") || DEFAULTS.textMessage,
    buttonMessage: byName.get("buttonMessage") || byName.get("message") || DEFAULTS.buttonMessage,
    menuButtonText: byName.get("menuButtonText") || DEFAULTS.menuButtonText,
    sizesButtonText: byName.get("sizesButtonText") || DEFAULTS.sizesButtonText,
  };

  return json({ data });
}

async function upsertSetting(name: string, value: string, type: string) {
  const existing = await settingPrismaEntity.findByContextAndName(CONTEXT, name);
  if (existing?.id) {
    await settingPrismaEntity.update(existing.id, { value, type });
    return;
  }

  await settingPrismaEntity.create({
    context: CONTEXT,
    name,
    type,
    value,
    createdAt: new Date(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();

  const enabled = form.get("enabled") === "on";
  const trigger = String(form.get("trigger") || DEFAULTS.trigger);
  const menuUrl = String(form.get("menuUrl") || DEFAULTS.menuUrl);
  const responseType = (String(form.get("responseType") || DEFAULTS.responseType) as "text" | "buttons");
  const textMessage = String(form.get("textMessage") || DEFAULTS.textMessage);
  const buttonMessage = String(form.get("buttonMessage") || DEFAULTS.buttonMessage);
  const menuButtonText = String(form.get("menuButtonText") || DEFAULTS.menuButtonText);
  const sizesButtonText = String(form.get("sizesButtonText") || DEFAULTS.sizesButtonText);

  await Promise.all([
    upsertSetting("enabled", String(enabled), "boolean"),
    upsertSetting("trigger", trigger, "string"),
    upsertSetting("menuUrl", menuUrl, "string"),
    upsertSetting("responseType", responseType, "string"),
    upsertSetting("textMessage", textMessage, "string"),
    upsertSetting("buttonMessage", buttonMessage, "string"),
    upsertSetting("menuButtonText", menuButtonText, "string"),
    upsertSetting("sizesButtonText", sizesButtonText, "string"),
  ]);

  return redirect("/admin/bot/meta-auto-responder");
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

export default function TrafficAutoResponderSettingsPage() {
  const { data } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const [textMessagePreview, setTextMessagePreview] = useState(data.textMessage);

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
      <div className="mb-8 space-y-3 rounded-xl bg-gradient-to-br from-muted/60 via-background to-muted/30 p-6 border border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">BOT / META</p>
            <h1 className="text-3xl font-semibold">META Autoresponder</h1>
            <p className="text-sm text-muted-foreground">
              Responde leads pagos quando o gatilho aparecer. Configure tipo de resposta, gatilhos e templates.
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
              <p className="text-xs text-muted-foreground">Responder quando gatilho aparecer.</p>
            </div>
            <Switch id="enabled" name="enabled" defaultChecked={data.enabled} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="trigger">Gatilhos (separe por vírgula)</Label>
            <Input id="trigger" name="trigger" defaultValue={data.trigger} />
          </div>

          <div className="col-span-1">
            <Label htmlFor="responseType">Tipo de resposta</Label>
            <Select name="responseType" defaultValue={data.responseType}>
              <SelectTrigger id="responseType">
                <SelectValue placeholder="Escolha o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto simples</SelectItem>
                <SelectItem value="buttons">Botões (Z-API)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>

      <Tabs defaultValue={data.responseType === "buttons" ? "buttons" : "text"} className="w-full space-y-4">
        <TabsList className="mb-0 rounded-lg border bg-background/80">
          <TabsTrigger value="text">Template texto</TabsTrigger>
          <TabsTrigger value="buttons">Template botões</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Suporta formatação estilo WhatsApp: *negrito*, _itálico_, monospace sem formatação.</span>
            <span className="text-[11px]">Preview (como será enviado)</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="textMessage">Mensagem (texto simples)</Label>
              <Textarea
                id="textMessage"
                name="textMessage"
                className="min-h-[280px] font-mono"
                value={textMessagePreview}
                onChange={(e) => setTextMessagePreview(e.target.value)}
                placeholder="Mensagem enviada quando o gatilho aparecer"
              />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed h-full">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Preview</p>
              <div
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={renderWhatsappPreview(`${textMessagePreview}`)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="buttons" className="rounded-xl border bg-background/70 p-4 shadow-sm">
          <div className="grid gap-3">
            <div>
              <Label htmlFor="buttonMessage">Mensagem principal (botões)</Label>
              <Textarea
                id="buttonMessage"
                name="buttonMessage"
                className="min-h-[120px]"
                defaultValue={data.buttonMessage}
                placeholder="Mensagem que antecede os botões"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="menuUrl">URL do cardápio (botão/link)</Label>
                <Input id="menuUrl" name="menuUrl" defaultValue={data.menuUrl} placeholder="https://..." />
              </div>
              <div>
                <Label htmlFor="menuButtonText">Texto do botão 1</Label>
                <Input id="menuButtonText" name="menuButtonText" defaultValue={data.menuButtonText} />
              </div>
              <div>
                <Label htmlFor="sizesButtonText">Texto do botão 2</Label>
                <Input id="sizesButtonText" name="sizesButtonText" defaultValue={data.sizesButtonText} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {actionData?.error && (
        <p className="mt-3 text-sm text-destructive">{String(actionData.error)}</p>
      )}
    </Form>
  );
}
