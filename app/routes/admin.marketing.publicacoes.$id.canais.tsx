import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  getContentPost,
  updateContentPostTarget,
} from "~/domain/content-post/content-post.server";
import { CONTENT_POST_CHANNELS } from "~/domain/content-post/content-post.shared";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({ post: await getContentPost(String(params.id || "")) });
}

function parseOrder(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const contentPostId = String(params.id || "");
  const form = await request.formData();
  const post = await getContentPost(contentPostId);
  const byChannel = new Map(
    post.Targets.map((target) => [target.channel, target])
  );
  const cardapio = byChannel.get(CONTENT_POST_CHANNELS.CARDAPIO_FEATURED);

  await Promise.all([
    updateContentPostTarget({
      contentPostId,
      channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
      enabled: form.get("cardapioFeatured") === "on",
      sortOrder: parseOrder(cardapio?.sortOrder ?? null),
      config: cardapio?.config,
    }),
    updateContentPostTarget({
      contentPostId,
      channel: CONTENT_POST_CHANNELS.WHATSAPP_STATUS,
      enabled: form.get("whatsappStatus") === "on",
      sortOrder: 1,
    }),
    updateContentPostTarget({
      contentPostId,
      channel: CONTENT_POST_CHANNELS.INSTAGRAM_STORY,
      enabled: form.get("instagramStory") === "on",
      sortOrder: 2,
    }),
  ]);

  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Canais salvos." });
}

function ChannelSwitch({
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

export default function ContentPostChannelsPage() {
  const { post } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const byChannel = new Map(
    post.Targets.map((target) => [target.channel, target])
  );
  const cardapio = byChannel.get(CONTENT_POST_CHANNELS.CARDAPIO_FEATURED);

  return (
    <Form method="post" className="grid max-w-2xl gap-6">
      <div>
        <h2 className="text-lg font-semibold">Canais ativados</h2>
        <p className="text-sm text-slate-500">
          Escolha quais abas e adaptadores ficam disponíveis para esta
          publicação.
        </p>
      </div>
      {post.status !== "active" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Os canais ficam configurados, mas só entram em atividade quando o
          conteúdo estiver “Ativo”.
        </div>
      ) : null}
      {actionData?.message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {actionData.message}
        </div>
      ) : null}

      <ChannelSwitch
        name="cardapioFeatured"
        title="Cardápio"
        description="Exibe a publicação no destaque do cardápio."
        defaultChecked={Boolean(cardapio?.enabled)}
      />
      <ChannelSwitch
        name="whatsappStatus"
        title="WhatsApp Status"
        description="Habilita configuração e publicação pelo adaptador Z-API."
        defaultChecked={Boolean(
          byChannel.get(CONTENT_POST_CHANNELS.WHATSAPP_STATUS)?.enabled
        )}
      />
      <ChannelSwitch
        name="instagramStory"
        title="Instagram Story"
        description="Habilita configuração e publicação pela Instagram Graph API."
        defaultChecked={Boolean(
          byChannel.get(CONTENT_POST_CHANNELS.INSTAGRAM_STORY)?.enabled
        )}
      />
      <Button type="submit" disabled={navigation.state === "submitting"}>
        {navigation.state === "submitting" ? "Salvando..." : "Salvar canais"}
      </Button>
    </Form>
  );
}
