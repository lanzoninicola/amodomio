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
import prismaClient from "~/lib/prisma/client.server";

function parseSortOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id: String(params.id || "") },
    select: {
      title: true,
      subtitle: true,
      key: true,
      sortOrder: true,
    },
  });
  if (!section) throw new Response("Destaque não encontrado", { status: 404 });
  return json({ section });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const subtitle = String(form.get("subtitle") || "").trim();
  const key = String(form.get("key") || "").trim();

  if (!title || !key) {
    return json(
      { ok: false, message: "Informe o título e a chave do destaque." },
      { status: 400 }
    );
  }

  await prismaClient.cardapioHighlightSection.update({
    where: { id: String(params.id || "") },
    data: {
      title,
      subtitle: subtitle || null,
      key,
      sortOrder: parseSortOrder(form.get("sortOrder")),
      deletedAt: null,
    },
  });

  return json({ ok: true, message: "Conteúdo salvo." });
}

export default function CardapioHighlightContentPage() {
  const { section } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Form method="post" className="grid min-w-0 max-w-2xl gap-6">
      <div>
        <h2 className="text-lg font-semibold">Conteúdo</h2>
        <p className="text-sm text-slate-500">
          Texto, identificação e ordem da seção promocional.
        </p>
      </div>

      {actionData?.message ? (
        <div
          className={
            actionData.ok
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {actionData.message}
        </div>
      ) : null}

      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <div className="grid gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" defaultValue={section.title} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sortOrder">Ordem</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={section.sortOrder}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="subtitle">Subtítulo</Label>
          <Input
            id="subtitle"
            name="subtitle"
            defaultValue={section.subtitle || ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="key">Chave</Label>
          <Input id="key" name="key" defaultValue={section.key} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={navigation.state === "submitting"}
          className="w-full sm:w-auto"
        >
          {navigation.state === "submitting"
            ? "Salvando..."
            : "Salvar conteúdo"}
        </Button>
      </div>
    </Form>
  );
}
