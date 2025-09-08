import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RuleHelp from "~/domain/bot/components/auto-responder-rule-help";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = String(params.id);
  const rule = await prismaClient.botAutoResponseRule.findUnique({ where: { id } });
  if (!rule) throw new Response("Not found", { status: 404 });
  return json({ rule });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id);
  const form = await request.formData();
  const intent = String(form.get("intent") || "update");

  if (intent === "update") {
    await prismaClient.botAutoResponseRule.update({
      where: { id },
      data: {
        label: String(form.get("label") || ""),
        trigger: String(form.get("trigger") || ""),
        isRegex: form.get("isRegex") === "on",
        response: String(form.get("response") || ""),
        priority: Number(form.get("priority") || 100),
        isActive: form.get("isActive") === "on",
        activeFrom: form.get("activeFrom") ? new Date(String(form.get("activeFrom"))) : null,
        activeTo: form.get("activeTo") ? new Date(String(form.get("activeTo"))) : null,
      },
    });
    return redirect("/admin/wpp/auto-responder");
  }

  if (intent === "delete") {
    await prismaClient.botAutoResponseRule.delete({ where: { id } });
    return redirect("/admin/wpp/auto-responder");
  }

  if (intent === "toggle") {
    const current = await prismaClient.botAutoResponseRule.findUnique({ where: { id } });
    await prismaClient.botAutoResponseRule.update({ where: { id }, data: { isActive: !current?.isActive } });
    return redirect("/admin/wpp/auto-responder");
  }

  return json({ ok: false, error: "intent inválido" }, { status: 400 });
}

export default function EditRulePage() {
  const { rule } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";

  const toLocal = (d?: string | Date | null) => {
    if (!d) return "";
    const date = new Date(d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar Regra</CardTitle>
      </CardHeader>
      <CardContent>
        <RuleHelp />
        <Form method="post" className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <input type="hidden" name="intent" value="update" />

          <div className="md:col-span-4">
            <Label>Nome</Label>
            <Input name="label" defaultValue={rule.label} />
          </div>
          <div className="md:col-span-4">
            <Label>Gatilho</Label>
            <Input name="trigger" defaultValue={rule.trigger} />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <input id="isRegex" name="isRegex" type="checkbox" defaultChecked={rule.isRegex} className="h-5 w-5" />
            <Label htmlFor="isRegex">Regex</Label>
          </div>
          <div className="md:col-span-2">
            <Label>Prioridade</Label>
            <Input type="number" name="priority" defaultValue={rule.priority} />
          </div>

          <div className="md:col-span-6">
            <Label>Janela (De)</Label>
            <Input type="datetime-local" name="activeFrom" defaultValue={toLocal(rule.activeFrom)} />
          </div>
          <div className="md:col-span-6">
            <Label>Janela (Até)</Label>
            <Input type="datetime-local" name="activeTo" defaultValue={toLocal(rule.activeTo)} />
          </div>

          <div className="md:col-span-12">
            <Label>Resposta</Label>
            <Textarea name="response" defaultValue={rule.response} className="min-h-[120px]" />
          </div>

          <div className="md:col-span-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input id="isActive" name="isActive" type="checkbox" defaultChecked={rule.isActive} className="h-5 w-5" />
              <Label htmlFor="isActive">Ativa</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando…" : "Salvar"}
              </Button>
              <Form method="post">
                <input type="hidden" name="intent" value="toggle" />
                <Button variant="secondary">Alternar</Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <Button variant="destructive">Excluir</Button>
              </Form>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
