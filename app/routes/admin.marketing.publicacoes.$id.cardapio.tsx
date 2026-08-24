import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Loader2, Send, Undo2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
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
import { CardapioMediaConfigFields } from "~/domain/content-post/components/cardapio-media-config-fields";
import {
  findOtherActiveContentTargets,
  getContentPost,
  runContentTargetOperation,
  setContentPostStatus,
  unpublishContentTarget,
  unpublishOtherActiveContentTargets,
  updateContentPostTarget,
} from "~/domain/content-post/content-post.server";
import {
  CONTENT_POST_CHANNELS,
  CONTENT_POST_STATUSES,
  parseCardapioFeaturedConfig,
  type CardapioFeaturedMediaConfig,
} from "~/domain/content-post/content-post.shared";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";

function parseOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const [post, menuItems] = await Promise.all([
    getContentPost(String(params.id || "")),
    prismaClient.item.findMany({
      where: {
        active: true,
        canSell: true,
        ItemSellingInfo: { is: { slug: { not: null } } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });
  const activeTargets = await findOtherActiveContentTargets(
    CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
    post.id
  );
  return json({ post, target, activeTargets, menuItems });
}

function parseMediaConfig(
  form: FormData,
  index: number
): CardapioFeaturedMediaConfig {
  const mode = String(form.get(`linkMode_${index}`) || "none");
  const value = (name: string) =>
    String(form.get(`${name}_${index}`) || "").trim() || null;
  return {
    linkUrl:
      mode === "internal" || mode === "external" ? value("linkUrl") : null,
    linkText: mode === "none" ? null : value("linkText"),
    linkMenuItemId: mode === "item" ? value("linkMenuItemId") : null,
    linkBackgroundColor: value("linkBackgroundColor"),
    linkTextColor: value("linkTextColor"),
    linkPosition:
      form.get(`linkPosition_${index}`) === "bottom" ? "bottom" : "top",
    linkNewTab: form.get(`linkNewTab_${index}`) !== "false",
    chipAction: mode === "none" ? "none" : mode === "modal" ? "modal" : "link",
    chipModalTitle: mode === "modal" ? value("chipModalTitle") : null,
    chipModalBody: mode === "modal" ? value("chipModalBody") : null,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const contentPostId = String(params.id || "");
  const form = await request.formData();
  const intent = String(form.get("_intent") || "save");
  const isPublish = intent.startsWith("publish");
  const activatePost = intent.includes("activate");
  const replaceActive = intent.endsWith("replace");
  const displayStyle = String(form.get("displayStyle") || "polaroid");
  const post = await getContentPost(contentPostId);
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });
  const availableMediaKeys = new Set(post.Media.map((media) => media.key));
  const selectedMediaKeys = form
    .getAll("cardapioMediaKey")
    .map(String)
    .filter((key) => availableMediaKeys.has(key));
  const mediaConfigByKey = Object.fromEntries(
    post.Media.map((media, index) => [media.key, parseMediaConfig(form, index)])
  );

  const activeTargets = isPublish
    ? await findOtherActiveContentTargets(
        CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
        contentPostId
      )
    : [];

  if (
    isPublish &&
    post.status === CONTENT_POST_STATUSES.DRAFT &&
    !activatePost
  ) {
    return json(
      {
        ok: false,
        requiresConfirmation: true,
        requiresActivation: true,
        activeTitles: activeTargets.map((item) => item.ContentPost.title),
        message: "Confirme a ativação da publicação.",
      },
      { status: 409 }
    );
  }

  if (
    isPublish &&
    post.status !== CONTENT_POST_STATUSES.ACTIVE &&
    !(post.status === CONTENT_POST_STATUSES.DRAFT && activatePost)
  ) {
    return json(
      {
        ok: false,
        message: "Apenas publicações em rascunho podem ser ativadas.",
      },
      { status: 409 }
    );
  }

  if (isPublish && activeTargets.length && !replaceActive) {
    return json(
      {
        ok: false,
        requiresConfirmation: true,
        requiresActivation: false,
        activeTitles: activeTargets.map((item) => item.ContentPost.title),
        message: "Confirme a substituição da publicação ativa.",
      },
      { status: 409 }
    );
  }

  if (isPublish && selectedMediaKeys.length === 0) {
    return json(
      {
        ok: false,
        message: "Selecione pelo menos uma mídia para publicar no Cardápio.",
      },
      { status: 400 }
    );
  }

  if (intent === "unpublish") {
    await unpublishContentTarget(target.id);
    await invalidateCardapioIndexCache();
    return json({ ok: true, message: "Removido do cardápio." });
  }

  if (isPublish && activatePost) {
    await setContentPostStatus(contentPostId, CONTENT_POST_STATUSES.ACTIVE);
  }

  await updateContentPostTarget({
    contentPostId,
    channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
    sortOrder: parseOrder(form.get("cardapioSortOrder")),
    config: {
      displayStyle: displayStyle === "default" ? "default" : "polaroid",
      showTitle: form.get("showTitle") === "on",
      showPromotionHint: form.get("showPromotionHint") === "on",
      promotionHintText:
        String(form.get("promotionHintText") || "").trim() || null,
      selectedMediaKeys,
      mediaConfigByKey,
    },
  });

  if (isPublish) {
    if (replaceActive) {
      await unpublishOtherActiveContentTargets(
        CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
        contentPostId
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
    return json({
      ok: true,
      message: activatePost
        ? "Publicação ativada e publicada no cardápio."
        : "Publicado no cardápio.",
    });
  }

  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Configuração do cardápio salva." });
}

function ConfigSwitch({
  name,
  title,
  description,
  defaultChecked,
  children,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-16 gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor={name}>{title}</Label>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <Switch id={name} name={name} defaultChecked={defaultChecked} />
      </div>
      {children}
    </div>
  );
}

export default function ContentPostCardapioPage() {
  const { post, target, activeTargets, menuItems } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const config = parseCardapioFeaturedConfig(target.config);
  const selectedMediaKeys = new Set(
    config.selectedMediaKeys ?? post.Media.map((media) => media.key)
  );
  const itemOptions = menuItems.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const submitting = navigation.state === "submitting";
  const publishingWithConfirmation =
    navigation.state !== "idle" &&
    String(navigation.formData?.get("_intent") || "").startsWith("publish-");
  const isPublished =
    target.status === "active" && Boolean(target.lastPublishedAt);
  const canUnpublish = isPublished;
  const confirmationTitles =
    actionData &&
    "activeTitles" in actionData &&
    Array.isArray(actionData.activeTitles)
      ? actionData.activeTitles
      : null;
  const serverRequiresConfirmation = Boolean(
    actionData &&
      "requiresConfirmation" in actionData &&
      actionData.requiresConfirmation
  );
  const serverRequiresActivation = Boolean(
    actionData &&
      "requiresActivation" in actionData &&
      actionData.requiresActivation
  );
  const activeTitles =
    confirmationTitles ?? activeTargets.map((item) => item.ContentPost.title);
  const needsActivation =
    post.status === CONTENT_POST_STATUSES.DRAFT || serverRequiresActivation;
  const needsReplacement = activeTitles.length > 0;
  const needsConfirmation = needsActivation || needsReplacement;
  const confirmPublishIntent = `publish${needsActivation ? "-activate" : ""}${
    needsReplacement ? "-replace" : ""
  }`;

  useEffect(() => {
    if (serverRequiresConfirmation) setReplaceDialogOpen(true);
  }, [serverRequiresConfirmation]);

  useEffect(() => {
    if (navigation.state === "idle" && actionData?.ok) {
      setReplaceDialogOpen(false);
    }
  }, [actionData, navigation.state]);

  return (
    <Form
      id="cardapio-publication-form"
      method="post"
      className="grid max-w-2xl gap-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Cardápio</h2>
            <Badge
              variant="outline"
              className={
                isPublished
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50"
              }
            >
              {isPublished ? "Publicado" : "Não publicado"}
            </Badge>
          </div>
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
            type={needsConfirmation ? "button" : "submit"}
            name={needsConfirmation ? undefined : "_intent"}
            value={needsConfirmation ? undefined : "publish"}
            size="sm"
            disabled={submitting}
            className="gap-2"
            onClick={() => {
              if (needsConfirmation) setReplaceDialogOpen(true);
            }}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Publicando..." : "Publicar"}
          </Button>
          <AlertDialog
            open={replaceDialogOpen}
            onOpenChange={(open) => {
              if (!publishingWithConfirmation) setReplaceDialogOpen(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {publishingWithConfirmation
                    ? "Atualizando o Cardápio..."
                    : needsActivation && needsReplacement
                    ? "Ativar e substituir publicação?"
                    : needsActivation
                    ? "Ativar e publicar no Cardápio?"
                    : "Substituir publicação ativa?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {publishingWithConfirmation ? (
                    <span className="flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin"
                        aria-hidden="true"
                      />
                      {needsActivation
                        ? "Ativando esta publicação"
                        : "Publicando esta publicação"}
                      {needsReplacement
                        ? " e substituindo a anterior."
                        : " no Cardápio."}{" "}
                      Aguarde a conclusão.
                    </span>
                  ) : (
                    <>
                      {needsActivation
                        ? "Esta publicação está em Rascunho. Ao continuar, ela será ativada e publicada no Cardápio."
                        : null}{" "}
                      {needsReplacement ? (
                        <>
                          {activeTitles.length === 1
                            ? `“${activeTitles[0]}” já está publicada no Cardápio.`
                            : `${activeTitles.length} publicações já estão ativas no Cardápio.`}{" "}
                          {activeTitles.length === 1
                            ? "Ela será"
                            : "Elas serão"}{" "}
                          despublicada{activeTitles.length === 1 ? "" : "s"} e
                          esta publicação ficará ativa.
                        </>
                      ) : null}
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={publishingWithConfirmation}>
                  Cancelar
                </AlertDialogCancel>
                <Button
                  type="submit"
                  form="cardapio-publication-form"
                  name="_intent"
                  value={confirmPublishIntent}
                  disabled={publishingWithConfirmation}
                  className="gap-2"
                >
                  {publishingWithConfirmation ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {publishingWithConfirmation
                    ? "Atualizando Cardápio..."
                    : needsActivation && needsReplacement
                    ? "Ativar e substituir"
                    : needsActivation
                    ? "Ativar e publicar"
                    : "Despublicar e publicar"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
        <div className="grid gap-3">
          <div>
            <Label>Mídias do Cardápio</Label>
            <p className="text-xs text-slate-500">
              Selecione somente as mídias deste canal. O acervo completo
              continua disponível na aba Mídias.
            </p>
          </div>
          {post.Media.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {post.Media.map((media, index) => {
                const channelMedia = config.mediaConfigByKey[media.key] || {
                  linkUrl: media.linkUrl,
                  linkText: media.linkText,
                  linkMenuItemId: media.linkMenuItemId,
                  linkBackgroundColor: media.linkBackgroundColor,
                  linkTextColor: media.linkTextColor,
                  linkPosition:
                    media.linkPosition === "bottom"
                      ? ("bottom" as const)
                      : ("top" as const),
                  linkNewTab: media.linkNewTab,
                  chipAction:
                    media.chipAction === "none" || media.chipAction === "modal"
                      ? media.chipAction
                      : ("link" as const),
                  chipModalTitle: media.chipModalTitle,
                  chipModalBody: media.chipModalBody,
                };
                return (
                  <div
                    key={media.id}
                    className="grid gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    {media.kind === "video" ? (
                      <video
                        src={media.mediaUrl}
                        className="aspect-[4/5] w-full rounded-md bg-slate-100 object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={media.mediaUrl}
                        alt={media.alt || media.title}
                        className="aspect-[4/5] w-full rounded-md bg-slate-100 object-cover"
                      />
                    )}
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="cardapioMediaKey"
                        value={media.key}
                        defaultChecked={selectedMediaKeys.has(media.key)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span className="font-medium">
                        {media.title || `Mídia ${index + 1}`}
                      </span>
                    </label>
                    <CardapioMediaConfigFields
                      index={index}
                      media={channelMedia}
                      itemOptions={itemOptions}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Adicione mídias ao acervo antes de configurar este canal.
            </div>
          )}
        </div>
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
          description="Exibe uma chamada abaixo da mídia promocional."
          defaultChecked={config.showPromotionHint}
        >
          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="promotionHintText">
              Texto da chamada promocional
            </Label>
            <Input
              id="promotionHintText"
              name="promotionHintText"
              defaultValue={config.promotionHintText || ""}
              placeholder="Toque para ver a promoção"
            />
            <p className="text-xs text-slate-500">
              Se ficar vazio, o cardápio usa a chamada padrão para cada
              dispositivo.
            </p>
          </div>
        </ConfigSwitch>
      </div>
    </Form>
  );
}
