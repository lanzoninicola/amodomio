import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { LinkIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  DEFAULT_CONTENT_LINK_BACKGROUND_COLOR,
  DEFAULT_CONTENT_LINK_TEXT_COLOR,
  parseContentPostMediaForm,
} from "~/domain/content-post/content-post-media.shared";
import {
  getContentPost,
  replaceContentPostMedia,
} from "~/domain/content-post/content-post.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({ post: await getContentPost(String(params.id || "")) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const post = await getContentPost(id);
  const form = await request.formData();
  try {
    await replaceContentPostMedia(
      id,
      parseContentPostMediaForm(form, post.title)
    );
    await invalidateCardapioIndexCache();
    return json({ ok: true, message: "Mídias salvas." });
  } catch (error: any) {
    return json(
      { ok: false, message: error?.message || "Erro ao salvar mídias." },
      { status: Number(error?.status) || 400 }
    );
  }
}

export default function ContentPostMediaPage() {
  const { post } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Form method="post" className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold">Mídias</h2>
        <p className="text-sm text-slate-500">
          Arquivos canônicos reutilizados por todos os canais.
        </p>
      </div>
      {actionData?.message ? (
        <div className="rounded-md border p-3 text-sm">
          {actionData.message}
        </div>
      ) : null}
      <a
        href="/admin/assets"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-blue-200 px-4 text-sm font-semibold text-blue-600 sm:w-fit"
      >
        Abrir gerenciador de assets
      </a>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mediaUrls">Mídias públicas</Label>
          <Textarea
            id="mediaUrls"
            name="mediaUrls"
            rows={7}
            defaultValue={post.Media.map((media) => media.mediaUrl).join("\n")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fullscreenMediaUrls">Versões ampliadas</Label>
          <Textarea
            id="fullscreenMediaUrls"
            name="fullscreenMediaUrls"
            rows={7}
            defaultValue={post.Media.map(
              (media) => media.fullscreenMediaUrl || media.mediaUrl
            ).join("\n")}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {post.Media.map((media, index) => (
          <div key={media.id} className="overflow-hidden rounded-lg border">
            {media.kind === "video" ? (
              <video
                src={media.mediaUrl}
                controls
                className="aspect-[4/5] w-full bg-black object-contain"
              />
            ) : (
              <img
                src={media.mediaUrl}
                alt={media.alt || media.title}
                className="aspect-[4/5] w-full bg-slate-100 object-cover"
              />
            )}
            <div className="grid gap-3 p-3">
              <div className="grid gap-2">
                <Label htmlFor={`linkUrl_${index}`}>Link</Label>
                <Input
                  id={`linkUrl_${index}`}
                  name={`linkUrl_${index}`}
                  defaultValue={media.linkUrl || ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`linkText_${index}`}>Texto do link</Label>
                <Input
                  id={`linkText_${index}`}
                  name={`linkText_${index}`}
                  defaultValue={media.linkText || ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name={`linkBackgroundColor_${index}`}
                  type="color"
                  defaultValue={
                    media.linkBackgroundColor ||
                    DEFAULT_CONTENT_LINK_BACKGROUND_COLOR
                  }
                />
                <Input
                  name={`linkTextColor_${index}`}
                  type="color"
                  defaultValue={
                    media.linkTextColor || DEFAULT_CONTENT_LINK_TEXT_COLOR
                  }
                />
              </div>
              {media.linkUrl && media.linkText ? (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <LinkIcon className="h-3 w-3" /> {media.linkText}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <Button type="submit" disabled={navigation.state === "submitting"}>
        {navigation.state === "submitting" ? "Salvando..." : "Salvar mídias"}
      </Button>
    </Form>
  );
}
