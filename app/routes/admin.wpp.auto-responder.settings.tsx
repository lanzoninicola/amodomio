import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch"; // shadcn

export async function loader({ }: LoaderFunctionArgs) {
  // TODO: requireUserSession(request)
  const setting = await prismaClient.botSetting.findFirst({ where: { id: 1 } });
  return json({ setting });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const enabled = form.get("enabled") === "on"; // Switch envia "on" se marcado

  await prismaClient.botSetting.upsert({
    where: { id: 1 },
    update: {
      enabled,
      businessStartHour: Number(form.get("businessStartHour") || 18),
      businessEndHour: Number(form.get("businessEndHour") || 22),
      businessDays: String(form.get("businessDays") || "3,4,5,6,0"),
      offHoursMessage: String(form.get("offHoursMessage") || ""),
    },
    create: {
      id: 1,
      enabled,
      businessStartHour: Number(form.get("businessStartHour") || 18),
      businessEndHour: Number(form.get("businessEndHour") || 22),
      businessDays: String(form.get("businessDays") || "3,4,5,6,0"),
      offHoursMessage: String(form.get("offHoursMessage") || "Estamos fora do horário. Voltamos em breve! 🍕"),
    },
  });
  return redirect("/admin/wpp/auto-responder/settings");
}

export default function SettingsPage() {
  const { setting } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="post" className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Switch global */}
          <div className="md:col-span-6 flex items-center justify-between border rounded-md p-3">
            <Label htmlFor="enabled">{`Auto-responder (${setting?.enabled === true ? 'ATIVO' : 'DESATIVO'})`} </Label>
            <Switch
              id="enabled"
              name="enabled"
              defaultChecked={setting?.enabled ?? false}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Início (hora)</Label>
            <Input name="businessStartHour" defaultValue={setting?.businessStartHour ?? 18} />
          </div>
          <div className="md:col-span-2">
            <Label>Fim (hora)</Label>
            <Input name="businessEndHour" defaultValue={setting?.businessEndHour ?? 22} />
          </div>
          <div className="md:col-span-6">
            <Label>Dias ativos (0=Dom .. 6=Sáb)</Label>
            <Input name="businessDays" defaultValue={setting?.businessDays ?? "3,4,5,6,0"} />
          </div>
          <div className="md:col-span-6">
            <Label>Mensagem fora do horário</Label>
            <Textarea name="offHoursMessage" defaultValue={setting?.offHoursMessage ?? "Estamos fora do horário. Voltamos em breve! 🍕"} />
          </div>
          <div className="md:col-span-6 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar"}</Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
