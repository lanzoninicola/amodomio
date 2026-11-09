import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AssetLibraryPickerDialog from "~/domain/media/components/asset-library-picker-dialog";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { STORE_OPENING_CONTEXT } from "~/domain/store-opening/store-opening-settings";
import {
  activateOffHoursMessage,
  createOffHoursMessage,
  deleteOffHoursMessage,
  listOffHoursMessages,
  parseOffHoursResponseType,
  updateOffHoursMessage,
  type OffHoursMessageInput,
  type OffHoursResponseType,
} from "~/domain/store-opening/off-hours-message.server";

const ROUTE_PATH = "/admin/atendimento/horarios/ausencia";
const TYPE_LABEL: Record<OffHoursResponseType, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const editId = url.searchParams.get("edit");
  const [settings, messages] = await Promise.all([
    settingPrismaEntity.findAllByContext(STORE_OPENING_CONTEXT),
    listOffHoursMessages(),
  ]);
  const byName = new Map(settings.map((setting) => [setting.name, setting.value]));
  const cooldownRaw = Number(byName.get("off-hours-cooldown-minutes") || 15);
  const aggregationRaw = Number(byName.get("off-hours-aggregation-seconds") || 20);

  return json({
    enabled: (byName.get("off-hours-enabled") ?? "true") === "true",
    cooldownMinutes: Number.isFinite(cooldownRaw) && cooldownRaw > 0 ? Math.floor(cooldownRaw) : 15,
    aggregationSeconds:
      Number.isFinite(aggregationRaw) && aggregationRaw >= 0 ? Math.floor(aggregationRaw) : 20,
    menuKeywords: byName.get("off-hours-menu-keywords") ?? "cardapio,cardápio,menu,sabores,preço,preco,valores",
    menuUrl: byName.get("off-hours-menu-url") || "https://amodomio.com.br/cardapio",
    menuMessage: byName.get("off-hours-menu-message") || "Nosso cardápio completo: {{link}}",
    messages: messages.map((message) => ({
      id: message.id,
      label: message.label,
      responseType: parseOffHoursResponseType(message.responseType),
      message: message.message,
      video: message.video,
      videoCaption: message.videoCaption,
      image: message.image,
      imageCaption: message.imageCaption,
      isActive: message.isActive,
    })),
    editId,
  });
}

async function upsertSetting(name: string, value: string, type: string) {
  const existing = await settingPrismaEntity.findByContextAndName(STORE_OPENING_CONTEXT, name);

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

function readMessageInput(form: FormData): OffHoursMessageInput {
  return {
    label: String(form.get("label") || "").trim() || "Mensagem sem nome",
    responseType: parseOffHoursResponseType(form.get("responseType")),
    message: String(form.get("message") || ""),
    video: String(form.get("video") || ""),
    videoCaption: String(form.get("videoCaption") || ""),
    image: String(form.get("image") || ""),
    imageCaption: String(form.get("imageCaption") || ""),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const id = String(form.get("id") || "");

  if (intent === "save-global") {
    const cooldownRaw = Number(form.get("cooldownMinutes") || 15);
    const aggregationRaw = Number(form.get("aggregationSeconds") || 20);
    await upsertSetting("off-hours-enabled", String(form.get("enabled") === "on"), "boolean");
    await upsertSetting(
      "off-hours-cooldown-minutes",
      String(Number.isFinite(cooldownRaw) && cooldownRaw > 0 ? Math.floor(cooldownRaw) : 15),
      "number"
    );
    await upsertSetting(
      "off-hours-aggregation-seconds",
      String(Number.isFinite(aggregationRaw) && aggregationRaw >= 0 ? Math.floor(aggregationRaw) : 20),
      "number"
    );
    await upsertSetting("off-hours-menu-keywords", String(form.get("menuKeywords") || ""), "string");
    await upsertSetting("off-hours-menu-url", String(form.get("menuUrl") || ""), "string");
    await upsertSetting("off-hours-menu-message", String(form.get("menuMessage") || ""), "string");
    return redirect(ROUTE_PATH);
  }

  if (intent === "create") {
    const created = await createOffHoursMessage(readMessageInput(form));
    return redirect(`${ROUTE_PATH}?edit=${created.id}`);
  }

  if (intent === "update" && id) {
    await updateOffHoursMessage(id, readMessageInput(form));
    return redirect(`${ROUTE_PATH}?edit=${id}`);
  }

  if (intent === "activate" && id) {
    await activateOffHoursMessage(id);
    return redirect(ROUTE_PATH);
  }

  if (intent === "delete" && id) {
    await deleteOffHoursMessage(id);
    return redirect(ROUTE_PATH);
  }

  return redirect(ROUTE_PATH);
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

function WhatsappPreview({ value }: { value: string }) {
  const html = useMemo(() => {
    const escaped = toWhatsappFormatting(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return { __html: escaped.replace(/\n/g, "<br />") };
  }, [value]);

  return (
    <div className="rounded-md border bg-muted/40 p-2 text-xs leading-relaxed">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">Preview</p>
      <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={html} />
    </div>
  );
}

type LoaderData = ReturnType<typeof useLoaderData<typeof loader>>;
type MessageRow = LoaderData["messages"][number];

const EMPTY_MESSAGE: Omit<MessageRow, "id" | "isActive"> = {
  label: "",
  responseType: "text",
  message: "Estamos fora do horário. Voltamos em breve! 🍕",
  video: "",
  videoCaption: "",
  image: "",
  imageCaption: "",
};

function MessageEditor({ message }: { message: MessageRow | null }) {
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const initial = message ?? EMPTY_MESSAGE;

  const [label, setLabel] = useState(initial.label);
  const [responseType, setResponseType] = useState<OffHoursResponseType>(initial.responseType);
  const [text, setText] = useState(initial.message);
  const [video, setVideo] = useState(initial.video);
  const [videoCaption, setVideoCaption] = useState(initial.videoCaption);
  const [image, setImage] = useState(initial.image);
  const [imageCaption, setImageCaption] = useState(initial.imageCaption);

  return (
    <Form method="post" className="rounded-xl border bg-background/70 p-4 shadow-sm flex flex-col gap-4">
      <input type="hidden" name="intent" value={message ? "update" : "create"} />
      <input type="hidden" name="id" value={message?.id ?? ""} />
      <input type="hidden" name="responseType" value={responseType} />
      <input type="hidden" name="message" value={text} />
      <input type="hidden" name="video" value={video} />
      <input type="hidden" name="videoCaption" value={videoCaption} />
      <input type="hidden" name="image" value={image} />
      <input type="hidden" name="imageCaption" value={imageCaption} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>{message ? "Editar mensagem" : "Nova mensagem"}</Label>
          <p className="text-xs text-muted-foreground">
            {message ? "Salve para aplicar as alterações." : "Salve para criar. Depois, ative na lista."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" type="button">
            <Link to={ROUTE_PATH}>Fechar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="label">Nome</Label>
          <Input
            id="label"
            name="label"
            placeholder="Ex.: Mudança 2026"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="response-type">Tipo de mensagem</Label>
          <Select value={responseType} onValueChange={(value) => setResponseType(value as OffHoursResponseType)}>
            <SelectTrigger id="response-type">
              <SelectValue placeholder="Escolha o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {responseType === "text" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="text-message">Mensagem de ausência</Label>
            <Textarea
              id="text-message"
              className="min-h-[220px] font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mensagem enviada fora do horário"
            />
            <p className="text-xs text-muted-foreground">Suporta *negrito* e _itálico_.</p>
          </div>
          <WhatsappPreview value={text} />
        </div>
      )}

      {responseType === "image" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <AssetLibraryPickerDialog
              allowedKinds={["image"]}
              defaultUploadPath="whatsapp/ausencia"
              triggerLabel="Escolher / enviar imagem"
              onSelect={(asset) => setImage(asset.url)}
            />
            <Input placeholder="https://..." value={image} onChange={(e) => setImage(e.target.value)} />
            <Textarea
              placeholder="Legenda (opcional)"
              className="min-h-[96px]"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
            />
            {(image || imageCaption) && (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => {
                  setImage("");
                  setImageCaption("");
                }}
              >
                Remover imagem
              </Button>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
            {image.trim() ? (
              <img src={image} alt="Imagem de ausência" className="w-full max-h-60 rounded-md object-contain bg-black/5" />
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma imagem selecionada.</p>
            )}
          </div>
        </div>
      )}

      {responseType === "video" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Input
              placeholder="https://... ou data:video/mp4;base64,..."
              value={video}
              onChange={(e) => setVideo(e.target.value)}
            />
            <Textarea
              placeholder="Legenda do vídeo"
              className="min-h-[96px]"
              value={videoCaption}
              onChange={(e) => setVideoCaption(e.target.value)}
            />
            <WhatsappPreview value={videoCaption} />
            {(video || videoCaption) && (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => {
                  setVideo("");
                  setVideoCaption("");
                }}
              >
                Remover vídeo
              </Button>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
            {video.trim() ? (
              <video controls className="w-full h-40 rounded-md object-contain bg-black/5" src={video} />
            ) : (
              <p className="text-xs text-muted-foreground">Informe o link/base64 para visualizar.</p>
            )}
          </div>
        </div>
      )}
    </Form>
  );
}

function GlobalSettingsForm({ data }: { data: LoaderData }) {
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const [enabled, setEnabled] = useState(data.enabled);
  const [cooldown, setCooldown] = useState(data.cooldownMinutes);
  const [aggregation, setAggregation] = useState(data.aggregationSeconds);
  const [menuKeywords, setMenuKeywords] = useState(data.menuKeywords);
  const [menuUrl, setMenuUrl] = useState(data.menuUrl);
  const [menuMessage, setMenuMessage] = useState(data.menuMessage);

  return (
    <Form method="post" className="rounded-xl border bg-background/70 p-4 shadow-sm flex flex-col gap-4">
      <input type="hidden" name="intent" value="save-global" />
      <input type="hidden" name="enabled" value={enabled ? "on" : "off"} />

      <div className="flex items-center justify-between">
        <div>
          <Label>Configurações gerais</Label>
          <p className="text-xs text-muted-foreground">Valem para a mensagem ativa.</p>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-background/60 px-4 py-3">
        <div>
          <Label htmlFor="enabled-toggle">Resposta automática</Label>
          <p className="text-xs text-muted-foreground">Envia a mensagem ativa quando a loja estiver fechada.</p>
        </div>
        <Switch id="enabled-toggle" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="cooldownMinutes">Cooldown (min)</Label>
          <Input
            id="cooldownMinutes"
            name="cooldownMinutes"
            type="number"
            min={1}
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">Intervalo mínimo para reenviar ao mesmo número.</p>
        </div>
        <div>
          <Label htmlFor="aggregationSeconds">Janela de agregação (s)</Label>
          <Input
            id="aggregationSeconds"
            name="aggregationSeconds"
            type="number"
            min={0}
            value={aggregation}
            onChange={(e) => setAggregation(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">Aguarda novas mensagens antes de responder (0 = imediato).</p>
        </div>
      </div>

      <div className="rounded-lg border bg-background/60 px-4 py-3 flex flex-col gap-3">
        <Label>Pedido de cardápio</Label>
        <p className="text-xs text-muted-foreground">
          Se o cliente pedir o cardápio com a loja fechada, envia a imagem da mensagem ativa (se houver) com o link.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="menuKeywords">Palavras-chave (separadas por vírgula)</Label>
              <Input
                id="menuKeywords"
                name="menuKeywords"
                value={menuKeywords}
                onChange={(e) => setMenuKeywords(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="menuUrl">Link do cardápio</Label>
              <Input id="menuUrl" name="menuUrl" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="menuMessage">Mensagem (use {"{{link}}"} para o link)</Label>
            <Textarea
              id="menuMessage"
              name="menuMessage"
              className="min-h-[96px]"
              value={menuMessage}
              onChange={(e) => setMenuMessage(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Form>
  );
}

function summarize(message: MessageRow) {
  if (message.responseType === "image") return message.image || "Sem imagem";
  if (message.responseType === "video") return message.video || "Sem vídeo";
  return message.message || "Sem texto";
}

export default function AtendimentoHorariosAusencia() {
  const data = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const isNew = data.editId === "new";
  const editing = isNew ? null : data.messages.find((message) => message.id === data.editId) ?? null;
  const showEditor = isNew || Boolean(editing);
  const hasActive = data.messages.some((message) => message.isActive);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border bg-background/70 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Mensagens de ausência</Label>
            <p className="text-xs text-muted-foreground">Apenas uma fica ativa. Ela é a usada quando a loja está fechada.</p>
          </div>
          <Button asChild variant="outline">
            <Link to={`${ROUTE_PATH}?edit=new`}>Nova mensagem</Link>
          </Button>
        </div>

        {!data.enabled && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            Resposta automática desligada. Ligue em “Configurações gerais” (abaixo) e salve.
          </p>
        )}

        {!hasActive && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            Nenhuma mensagem ativa. Nada será enviado fora do horário.
          </p>
        )}

        {data.messages.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma mensagem cadastrada.</p>
        )}

        <ul className="flex flex-col gap-2">
          {data.messages.map((message) => (
            <li
              key={message.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/60 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{message.label}</span>
                  <Badge variant="outline">{TYPE_LABEL[message.responseType]}</Badge>
                  {message.isActive && <Badge>Ativa</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{summarize(message)}</p>
              </div>
              <div className="flex gap-2">
                {!message.isActive && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="activate" />
                    <input type="hidden" name="id" value={message.id} />
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                      Ativar
                    </Button>
                  </Form>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link to={`${ROUTE_PATH}?edit=${message.id}`}>Editar</Link>
                </Button>
                <Form
                    method="post"
                    onSubmit={(event) => {
                      const warning = message.isActive
                        ? `Excluir "${message.label}"? Ela está ativa, nenhuma ficará ativa.`
                        : `Excluir "${message.label}"?`;
                      if (!window.confirm(warning)) event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={message.id} />
                    <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
                      Excluir
                    </Button>
                  </Form>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showEditor && <MessageEditor key={data.editId} message={editing} />}

      <GlobalSettingsForm data={data} />
    </div>
  );
}
