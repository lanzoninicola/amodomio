import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import {
  ASYNC_JOBS_SETTINGS_CONTEXT,
  ASYNC_JOBS_WHATSAPP_ENABLED_SETTING,
  ASYNC_JOBS_WHATSAPP_ON_COMPLETED_SETTING,
  ASYNC_JOBS_WHATSAPP_ON_FAILED_SETTING,
  ASYNC_JOBS_WHATSAPP_ON_STARTED_SETTING,
  ASYNC_JOBS_WHATSAPP_PHONE_SETTING,
  getAsyncJobsWhatsappSettings,
} from "~/domain/async-jobs/async-jobs-whatsapp.server";
import { DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS } from "~/domain/async-jobs/async-jobs-whatsapp-settings";
import { normalizePhone } from "~/domain/z-api/zapi.service";

type ActionData = {
  error?: string;
};

export async function loader({}: LoaderFunctionArgs) {
  const settings = await getAsyncJobsWhatsappSettings();
  return json({ settings });
}

async function upsertSetting(name: string, value: string, type: string) {
  const existing = await settingPrismaEntity.findByContextAndName(ASYNC_JOBS_SETTINGS_CONTEXT, name);
  if (existing?.id) {
    await settingPrismaEntity.update(existing.id, { value, type });
    return;
  }

  await settingPrismaEntity.create({
    context: ASYNC_JOBS_SETTINGS_CONTEXT,
    name,
    type,
    value,
    createdAt: new Date(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const enabled = form.get("enabled") === "on";
  const phoneRaw = String(form.get("phone") || "").trim();
  const notifyOnStarted = form.get("notifyOnStarted") === "on";
  const notifyOnCompleted = form.get("notifyOnCompleted") === "on";
  const notifyOnFailed = form.get("notifyOnFailed") === "on";

  const normalizedPhone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !normalizedPhone) {
    return json<ActionData>(
      { error: "Número inválido. Use DDI + DDD + número, somente dígitos." },
      { status: 400 },
    );
  }

  const updates = [
    { name: ASYNC_JOBS_WHATSAPP_ENABLED_SETTING, value: String(enabled), type: "boolean" },
    { name: ASYNC_JOBS_WHATSAPP_PHONE_SETTING, value: normalizedPhone || "", type: "string" },
    { name: ASYNC_JOBS_WHATSAPP_ON_STARTED_SETTING, value: String(notifyOnStarted), type: "boolean" },
    { name: ASYNC_JOBS_WHATSAPP_ON_COMPLETED_SETTING, value: String(notifyOnCompleted), type: "boolean" },
    { name: ASYNC_JOBS_WHATSAPP_ON_FAILED_SETTING, value: String(notifyOnFailed), type: "boolean" },
  ];

  for (const update of updates) {
    await upsertSetting(update.name, update.value, update.type);
  }

  return redirect("/admin/async-jobs/settings");
}

export default function AdminAsyncJobsSettingsRoute() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const [enabled, setEnabled] = useState(settings.enabled);
  const [notifyOnStarted, setNotifyOnStarted] = useState(settings.notifyOnStarted);
  const [notifyOnCompleted, setNotifyOnCompleted] = useState(settings.notifyOnCompleted);
  const [notifyOnFailed, setNotifyOnFailed] = useState(settings.notifyOnFailed);

  return (
    <Form method="post" className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
            <p className="max-w-2xl text-sm text-slate-500">
              Configura notificações de WhatsApp para o contexto global <code>async-jobs</code>.
            </p>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar settings"}
          </Button>
        </div>

        {actionData?.error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionData.error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="enabled">Ativar envio de WhatsApp</Label>
                <p className="text-xs text-slate-500">Liga ou desliga as notificações deste contexto.</p>
              </div>
              <input type="hidden" name="enabled" value={enabled ? "on" : "off"} />
              <Switch id="enabled" checked={enabled} onCheckedChange={(value) => setEnabled(Boolean(value))} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <Label htmlFor="phone">Número destino</Label>
            <p className="mb-2 text-xs text-slate-500">Formato esperado: somente dígitos, com DDI e DDD.</p>
            <Input
              id="phone"
              name="phone"
              defaultValue={settings.phone || DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS.phone}
              placeholder="5511999999999"
              inputMode="numeric"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Quando enviar</h3>
          <p className="text-sm text-slate-500">Escolha quais eventos do job disparam a mensagem.</p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <div className="text-sm font-medium text-slate-900">Início do job</div>
              <div className="text-xs text-slate-500">Envia quando o job muda para execução.</div>
            </div>
            <input type="hidden" name="notifyOnStarted" value={notifyOnStarted ? "on" : "off"} />
            <Switch
              id="notifyOnStarted"
              checked={notifyOnStarted}
              onCheckedChange={(value) => setNotifyOnStarted(Boolean(value))}
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <div className="text-sm font-medium text-slate-900">Fim do job</div>
              <div className="text-xs text-slate-500">Envia quando o job conclui com sucesso.</div>
            </div>
            <input type="hidden" name="notifyOnCompleted" value={notifyOnCompleted ? "on" : "off"} />
            <Switch
              id="notifyOnCompleted"
              checked={notifyOnCompleted}
              onCheckedChange={(value) => setNotifyOnCompleted(Boolean(value))}
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <div className="text-sm font-medium text-slate-900">Erro do job</div>
              <div className="text-xs text-slate-500">Envia quando a execução falha.</div>
            </div>
            <input type="hidden" name="notifyOnFailed" value={notifyOnFailed ? "on" : "off"} />
            <Switch
              id="notifyOnFailed"
              checked={notifyOnFailed}
              onCheckedChange={(value) => setNotifyOnFailed(Boolean(value))}
            />
          </label>
        </div>
      </section>
    </Form>
  );
}
