import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useNavigation } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import RuleHelp from "~/domain/bot/components/auto-responder-rule-help";

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  await prismaClient.botAutoResponseRule.create({
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
  return redirect("/admin/bot/auto-responder");
}

export default function NewRulePage() {
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Regra</CardTitle>
      </CardHeader>
      <CardContent>
        <RuleHelp />
        <Form method="post" className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <Label>Nome</Label>
            <Input name="label" required placeholder="Saudação Oi/Olá" />
          </div>
          <div className="md:col-span-4">
            <Label>Gatilho</Label>
            <Input name="trigger" required placeholder="oi|olá (regex) ou 'cardápio'" />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <input id="isRegex" type="checkbox" name="isRegex" className="h-5 w-5" />
            <Label htmlFor="isRegex">Regex</Label>
          </div>
          <div className="md:col-span-2">
            <Label>Prioridade</Label>
            <Input type="number" name="priority" defaultValue={100} />
          </div>

          <div className="md:col-span-6">
            <Label>Janela (De)</Label>
            <Input type="datetime-local" name="activeFrom" />
          </div>
          <div className="md:col-span-6">
            <Label>Janela (Até)</Label>
            <Input type="datetime-local" name="activeTo" />
          </div>

          <div className="md:col-span-12">
            <Label>Resposta</Label>
            <Textarea name="response" required placeholder="Olá! Digite 1 para Cardápio, 2 para Promoções…" className="min-h-[120px]" />
          </div>

          <div className="md:col-span-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="isActive" name="isActive" defaultChecked />
              <Label htmlFor="isActive">Ativa</Label>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Criar regra"}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
