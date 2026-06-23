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
import { Textarea } from "~/components/ui/textarea";
import {
  getContentPost,
  setContentPostStatus,
  updateContentPostDetails,
} from "~/domain/content-post/content-post.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({ post: await getContentPost(String(params.id || "")) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const form = await request.formData();
  try {
    await updateContentPostDetails(id, {
      title: String(form.get("title") || ""),
      subtitle: String(form.get("subtitle") || ""),
      key: String(form.get("key") || ""),
      caption: String(form.get("caption") || ""),
    });
    await setContentPostStatus(id, form.get("status"));
    await invalidateCardapioIndexCache();
    return json({ ok: true, message: "Conteúdo salvo." });
  } catch (error: any) {
    return json(
      { ok: false, message: error?.message || "Erro ao salvar." },
      { status: Number(error?.status) || 400 }
    );
  }
}

export default function ContentPostContentPage() {
  const { post } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Form method="post" className="grid max-w-2xl gap-5">
      <div>
        <h2 className="text-lg font-semibold">Conteúdo editorial</h2>
        <p className="text-sm text-slate-500">
          Fonte única de título, legenda e ciclo de vida.
        </p>
      </div>
      {actionData?.message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            actionData.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {actionData.message}
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" defaultValue={post.title} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="subtitle">Subtítulo</Label>
        <Input
          id="subtitle"
          name="subtitle"
          defaultValue={post.subtitle || ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="key">Chave estável</Label>
        <Input id="key" name="key" defaultValue={post.key} />
        <p className="text-xs text-slate-500">
          Também identifica esta publicação no relatório do cardápio.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="caption">Texto/legenda base</Label>
        <Textarea
          id="caption"
          name="caption"
          rows={5}
          defaultValue={post.caption || ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Estado editorial</Label>
        <Select name="status" defaultValue={post.status}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Sair de “Ativo” remove o destaque do cardápio e interrompe os canais
          sociais.
        </p>
      </div>
      <Button type="submit" disabled={navigation.state === "submitting"}>
        {navigation.state === "submitting" ? "Salvando..." : "Salvar conteúdo"}
      </Button>
    </Form>
  );
}
