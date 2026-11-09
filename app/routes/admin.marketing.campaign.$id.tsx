import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import prisma from "~/lib/prisma/client.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.campaign.name || "Campanha"} | Marketing` },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const campaign = await prisma.crmCampaign.findUnique({
    where: { id: String(params.id || "") },
    include: { _count: { select: { sends: true } } },
  });

  if (!campaign) throw new Response("Campanha não encontrada", { status: 404 });
  return json({ campaign });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const form = await request.formData();
  const intent = String(form.get("_intent") || "update");

  if (intent === "delete") {
    const sendCount = await prisma.crmCampaignSend.count({
      where: { campaign_id: id },
    });
    if (sendCount > 0) {
      return json(
        {
          ok: false,
          message:
            "Não é possível eliminar uma campanha com envios registrados.",
        },
        { status: 400 }
      );
    }
    await prisma.crmCampaign.delete({ where: { id } });
    throw redirect("/admin/marketing/campaign");
  }

  const name = String(form.get("name") || "").trim();
  if (!name)
    return json(
      { ok: false, message: "Informe o nome da campanha." },
      { status: 400 }
    );

  await prisma.crmCampaign.update({
    where: { id },
    data: {
      name,
      description: String(form.get("description") || "").trim() || null,
      source: String(form.get("source") || "").trim() || null,
      external_id: String(form.get("external_id") || "").trim() || null,
    },
  });

  return json({ ok: true, message: "Campanha salva." });
}

export default function AdminMarketingCampaignEdit() {
  const { campaign } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="space-y-4">
        <Link
          to="/admin/marketing/campaign"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
        >
          <ChevronLeft size={14} />
          campanhas
        </Link>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {campaign.name}
          </h2>
          <p className="text-sm text-slate-500">
            {campaign._count.sends} envio(s) registrado(s) nesta campanha.
          </p>
        </div>
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

      <Form method="post" className="space-y-5">
        <input type="hidden" name="_intent" value="update" />
        <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={campaign.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={campaign.description || ""}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="source">Origem</Label>
              <Input
                id="source"
                name="source"
                defaultValue={campaign.source || ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="external_id">ID externo</Label>
              <Input
                id="external_id"
                name="external_id"
                defaultValue={campaign.external_id || ""}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar campanha"}
          </Button>
        </div>
      </Form>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5">
        <div>
          <div className="font-semibold text-red-900">Eliminar campanha</div>
          <p className="text-sm text-red-700">
            {campaign._count.sends > 0
              ? "Campanhas com envios registrados não podem ser eliminadas."
              : "Esta ação não pode ser desfeita."}
          </p>
        </div>
        <Form
          method="post"
          onSubmit={(event) => {
            if (!window.confirm("Eliminar esta campanha?"))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="_intent" value="delete" />
          <Button
            type="submit"
            variant="destructive"
            disabled={campaign._count.sends > 0 || isSubmitting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </Form>
      </div>
    </div>
  );
}
