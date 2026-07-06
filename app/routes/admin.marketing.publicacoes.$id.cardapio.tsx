import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Send, Undo2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import {
  getContentPost,
  runContentTargetOperation,
  unpublishContentTarget,
  updateContentPostTarget,
} from "~/domain/content-post/content-post.server";
import {
  CONTENT_POST_CHANNELS,
  CONTENT_POST_STATUSES,
  parseCardapioFeaturedConfig,
} from "~/domain/content-post/content-post.shared";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

function parseOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await getContentPost(String(params.id || ""));
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });
  return json({ post, target });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const contentPostId = String(params.id || "");
  const form = await request.formData();
  const intent = String(form.get("_intent") || "save");
  const displayStyle = String(form.get("displayStyle") || "polaroid");
  const post = await getContentPost(contentPostId);
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });

  if (intent === "unpublish") {
    await unpublishContentTarget(target.id);
    await invalidateCardapioIndexCache();
    return json({ ok: true, message: "Removido do cardápio." });
  }

  await updateContentPostTarget({
    contentPostId,
    channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
    sortOrder: parseOrder(form.get("cardapioSortOrder")),
    config: {
      displayStyle: displayStyle === "default" ? "default" : "polaroid",
      showTitle: form.get("showTitle") === "on",
      showPromotionHint: form.get("showPromotionHint") === "on",
    },
  });

  if (intent === "publish") {
    if (post.status !== CONTENT_POST_STATUSES.ACTIVE) {
      return json(
        { ok: false, message: "Ative o conteúdo primeiro." },
        { status: 409 }
      );
    }

    await runContentTargetOperation({
      targetId: target.id,
      operation: "publish",
      source: "manual",
      execute: async () => ({
        channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
      }),
      response: (value) => value,
    });
    await invalidateCardapioIndexCache();
    return json({ ok: true, message: "Publicado no cardápio." });
  }

  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Configuração do cardápio salva." });
}

function ConfigSwitch({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg border p-4">
      <div>
        <Label htmlFor={name}>{title}</Label>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}

export default function ContentPostCardapioPage() {
  const { post, target } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const config = parseCardapioFeaturedConfig(target.config);
  const submitting = navigation.state === "submitting";
  const canUnpublish = target.status === "active" && Boolean(target.lastPublishedAt);

  return (
    <Form method="post" className="grid max-w-2xl gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Cardápio</h2>
          <p className="text-sm text-slate-500">
            Ajuste como esta publicação aparece no destaque do cardápio.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            type="submit"
            name="_intent"
            value="unpublish"
            size="sm"
            variant="outline"
            disabled={submitting || !canUnpublish}
            className="gap-2"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Removendo..." : "Despublicar"}
          </Button>
          <Button
            type="submit"
            name="_intent"
            value="publish"
            size="sm"
            disabled={submitting}
            className="gap-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>

      <Separator className="my-1" />

      {post.status !== "active" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          A configuração fica salva, mas só aparece no cardápio quando o
          conteúdo estiver “Ativo”.
        </div>
      ) : null}
      {actionData?.message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {actionData.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-700">Configuração</h3>
        <Button
          type="submit"
          name="_intent"
          value="save"
          size="sm"
          variant="outline"
          disabled={submitting}
        >
          {submitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="cardapioSortOrder">Ordem</Label>
            <Input
              id="cardapioSortOrder"
              name="cardapioSortOrder"
              type="number"
              defaultValue={target.sortOrder || 0}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayStyle">Estilo</Label>
            <Select name="displayStyle" defaultValue={config.displayStyle}>
              <SelectTrigger id="displayStyle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polaroid">Polaroid</SelectItem>
                <SelectItem value="default">Padrão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ConfigSwitch
          name="showTitle"
          title="Mostrar título"
          description="Exibe título e subtítulo no cardápio."
          defaultChecked={config.showTitle}
        />
        <ConfigSwitch
          name="showPromotionHint"
          title="Mostrar chamada promocional"
          description="Exibe “Toque para ver a promoção”."
          defaultChecked={config.showPromotionHint}
        />
      </div>
    </Form>
  );
}
