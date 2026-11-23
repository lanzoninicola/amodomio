import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authenticator } from "~/domain/auth/google.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) throw new Response("Não autorizado", { status: 401 });
  const item = await prismaClient.item.findUnique({ where: { id: params.id }, select: { id: true, name: true, LabelingConfig: true } });
  if (!item) throw new Response("Item não encontrado", { status: 404 });
  return json({ item });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) throw new Response("Não autorizado", { status: 401 });
  const form = await request.formData();
  const days = Number(form.get("days") || 0);
  const hours = Number(form.get("hours") || 0);
  const minutes = Math.round(days * 1440 + hours * 60);
  if (!params.id || !Number.isFinite(minutes) || minutes <= 0) return json({ ok: false, message: "Informe uma validade maior que zero." }, { status: 400 });
  await prismaClient.itemLabelingConfig.upsert({
    where: { itemId: params.id },
    update: { enabled: form.get("enabled") === "on", shelfLifeMinutes: minutes,
      conservation: String(form.get("conservation") || "").trim() || null,
      labelName: String(form.get("labelName") || "").trim() || null },
    create: { itemId: params.id, enabled: form.get("enabled") === "on", shelfLifeMinutes: minutes,
      conservation: String(form.get("conservation") || "").trim() || null,
      labelName: String(form.get("labelName") || "").trim() || null },
  });
  return json({ ok: true, message: "Configuração de etiqueta salva." });
}

export default function ItemLabelingPage() {
  const { item } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const config = item.LabelingConfig;
  const days = Math.floor((config?.shelfLifeMinutes || 0) / 1440);
  const hours = Math.floor(((config?.shelfLifeMinutes || 0) % 1440) / 60);
  return <div className="max-w-2xl space-y-6 rounded-xl border bg-white p-6">
    <div><h3 className="text-lg font-semibold">Etiqueta de manipulação</h3><p className="text-sm text-muted-foreground">Usa o item {item.name}; nenhum produto adicional será criado.</p></div>
    {result?.message ? <p className={result.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{result.message}</p> : null}
    <Form method="post" className="space-y-5">
      <label className="flex items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={config?.enabled ?? true} /> Disponível nas telas de etiquetas</label>
      <div className="space-y-2"><Label htmlFor="labelName">Nome na etiqueta</Label><Input id="labelName" name="labelName" defaultValue={config?.labelName || ""} placeholder={item.name} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label htmlFor="days">Validade — dias</Label><Input id="days" name="days" type="number" min="0" defaultValue={days} /></div>
        <div className="space-y-2"><Label htmlFor="hours">Horas adicionais</Label><Input id="hours" name="hours" type="number" min="0" max="23" defaultValue={hours} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="conservation">Conservação</Label><Input id="conservation" name="conservation" defaultValue={config?.conservation || "Conservar refrigerado"} /></div>
      <Button type="submit">Salvar configuração</Button>
    </Form>
  </div>;
}
