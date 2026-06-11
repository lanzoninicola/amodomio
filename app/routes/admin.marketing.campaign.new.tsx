import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import prisma from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Nova campanha | Marketing" },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim();
  const source = String(form.get("source") || "").trim();
  const externalId = String(form.get("external_id") || "").trim();

  if (!name) {
    return json(
      { ok: false, message: "Informe o nome da campanha." },
      { status: 400 }
    );
  }

  const campaign = await prisma.crmCampaign.create({
    data: {
      name,
      description: description || null,
      source: source || null,
      external_id: externalId || null,
    },
    select: { id: true },
  });

  throw redirect(`/admin/marketing/campaign/${campaign.id}`);
}

export default function AdminMarketingCampaignNew() {
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
            Nova campanha
          </h2>
          <p className="text-sm text-slate-500">
            Cadastre a identificação da campanha de marketing.
          </p>
        </div>
      </div>

      <CampaignForm
        actionData={actionData}
        submitting={isSubmitting}
        submitLabel="Criar campanha"
      />
    </div>
  );
}

function CampaignForm({
  actionData,
  submitting,
  submitLabel,
}: {
  actionData?: { ok: boolean; message: string };
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <Form method="post" className="space-y-5">
      {actionData?.message ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionData.message}
        </div>
      ) : null}

      <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea id="description" name="description" rows={5} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="source">Origem</Label>
            <Input
              id="source"
              name="source"
              placeholder="Ex.: whatsapp, email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="external_id">ID externo</Label>
            <Input id="external_id" name="external_id" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </Form>
  );
}
