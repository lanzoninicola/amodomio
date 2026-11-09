import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { createContentPost } from "~/domain/content-post/content-post.server";
import { slugifyContentPostKey } from "~/domain/content-post/content-post.shared";

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const key =
    String(form.get("key") || "").trim() || slugifyContentPostKey(title);

  try {
    const post = await createContentPost({
      key,
      title,
      subtitle: String(form.get("subtitle") || ""),
      caption: String(form.get("caption") || ""),
      media: [],
    });
    throw redirect(`/admin/marketing/publicacoes/${post.id}`);
  } catch (error: any) {
    if (error instanceof Response) throw error;
    return json(
      { ok: false, message: error?.message || "Erro ao criar publicação." },
      { status: Number(error?.status) || 400 }
    );
  }
}

export default function NewContentPost() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div className="max-w-2xl pb-12">
      <Link
        to="/admin/marketing/publicacoes"
        className="mb-5 inline-flex items-center gap-1 text-sm font-semibold"
      >
        <ChevronLeft size={14} /> publicações
      </Link>
      <h2 className="text-2xl font-semibold">Nova publicação</h2>
      <p className="mb-6 text-sm text-slate-500">
        O conteúdo nasce como rascunho. Ative e escolha os canais depois.
      </p>

      <Form method="post" className="grid gap-5">
        {actionData?.message ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {actionData.message}
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="subtitle">Subtítulo</Label>
          <Input id="subtitle" name="subtitle" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="key">Chave estável</Label>
          <Input id="key" name="key" placeholder="gerada a partir do título" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="caption">Texto/legenda base</Label>
          <Textarea id="caption" name="caption" rows={4} />
        </div>
        <Button type="submit" disabled={navigation.state === "submitting"}>
          {navigation.state === "submitting"
            ? "Criando..."
            : "Criar publicação"}
        </Button>
      </Form>
    </div>
  );
}
