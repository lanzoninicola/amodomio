import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import prismaClient from "~/lib/prisma/client.server";
import { createCampaign, sendCampaignNow } from "~/domain/push/web-push.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const hasVapidKeys = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const url = new URL(request.url);
  const cloneId = url.searchParams.get("clone");
  let cloneData: any = null;

  if (cloneId) {
    cloneData = await prismaClient.pushNotificationCampaign.findUnique({ where: { id: cloneId } });
  }

  return json({ hasVapidKeys, cloneData });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = (formData.get("intent") || "send").toString();
  const title = (formData.get("title") || "").toString().trim();
  const body = (formData.get("body") || "").toString().trim();
  const url = (formData.get("url") || "").toString().trim() || undefined;
  const scheduledAtStr = (formData.get("scheduledAt") || "").toString().trim();
  const scheduledAt = scheduledAtStr ? new Date(scheduledAtStr) : null;
  const onlySave = intent === "save";

  if (!title || !body) {
    return json({ error: "Título e corpo são obrigatórios." }, { status: 400 });
  }

  try {
    const campaign = await createCampaign({
      title,
      body,
      url,
      scheduledAt,
      status: onlySave ? "scheduled" : "sent",
    });

    if (onlySave) {
      return redirect("/admin/push-notifications?saved=1");
    }

    await sendCampaignNow(campaign.id);
    return redirect("/admin/push-notifications?sent=1");
  } catch (error: any) {
    return json({ error: error?.message || "Erro ao processar notificações." }, { status: 500 });
  }
}

export default function AdminPushNotificationsNew() {
  const { hasVapidKeys, cloneData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const isSubmittingSend = useMemo(
    () => navigation.state === "submitting" && navigation.formData?.get("intent") === "send",
    [navigation]
  );
  const isSubmittingSave = useMemo(
    () => navigation.state === "submitting" && navigation.formData?.get("intent") === "save",
    [navigation]
  );

  useEffect(() => {
    const saved = searchParams.get("saved");
    const sent = searchParams.get("sent");
    if (saved || sent) {
      // intentionally no-op; these params handled on list page
    }
  }, [searchParams]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nova campanha</h1>
          <p className="text-sm text-muted-foreground">Crie e envie uma nova notificação.</p>
          {!hasVapidKeys && (
            <p className="text-sm text-red-600 mt-2">
              VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes. Configure antes de enviar.
            </p>
          )}
        </div>
        <Link to="/admin/push-notifications">
          <Button variant="ghost">Voltar para lista</Button>
        </Link>
      </div>

      <Form method="post" className="space-y-3 border rounded-md p-4 bg-white shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium">Título</label>
          <Input name="title" defaultValue={cloneData?.title ?? ""} placeholder="Ex: Promoção de hoje!" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Corpo</label>
          <Textarea
            name="body"
            defaultValue={cloneData?.body ?? ""}
            placeholder="Mensagem da notificação"
            required
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">URL de destino (opcional)</label>
          <Input name="url" defaultValue={cloneData?.url ?? ""} placeholder="https://www.seusite.com/promo" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Agendar envio (opcional)</label>
          <Input type="datetime-local" name="scheduledAt" />
        </div>
        <div className="flex gap-2">
          <Button name="intent" value="send" type="submit" disabled={!hasVapidKeys || isSubmittingSend}>
            {isSubmittingSend ? "Enviando..." : "Enviar agora"}
          </Button>
          <Button
            name="intent"
            value="save"
            type="submit"
            variant="secondary"
            disabled={isSubmittingSave}
          >
            {isSubmittingSave ? "Salvando..." : "Salvar para depois"}
          </Button>
        </div>
      </Form>

      {actionData?.error && <div className="text-sm text-red-600">{actionData.error}</div>}
    </div>
  );
}
