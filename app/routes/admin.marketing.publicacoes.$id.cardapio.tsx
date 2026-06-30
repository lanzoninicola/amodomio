import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
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
import { Switch } from "~/components/ui/switch";
import {
  getContentPost,
  updateContentPostTarget,
} from "~/domain/content-post/content-post.server";
import {
  CONTENT_POST_CHANNELS,
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
  const displayStyle = String(form.get("displayStyle") || "polaroid");
  const post = await getContentPost(contentPostId);
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });

  await updateContentPostTarget({
    contentPostId,
    channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
    enabled: target.enabled,
    sortOrder: parseOrder(form.get("cardapioSortOrder")),
    config: {
      displayStyle: displayStyle === "default" ? "default" : "polaroid",
      showTitle: form.get("showTitle") === "on",
      showPromotionHint: form.get("showPromotionHint") === "on",
    },
  });

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

  return (
    <Form method="post" className="grid max-w-2xl gap-6">
      {!target.enabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Habilite Cardápio na aba Canais ativados.
        </div>
      ) : null}
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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Cardápio</h2>
          <p className="text-sm text-slate-500">
            Ajuste como esta publicação aparece no destaque do cardápio.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={navigation.state === "submitting"}>
          {navigation.state === "submitting" ? "Salvando..." : "Salvar"}
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
