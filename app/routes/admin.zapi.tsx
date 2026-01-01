import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useMemo } from "react";
import { ValidationError } from "~/domain/z-api/errors";
import { ZApiError } from "~/domain/z-api/zapi-client.server";
import { sendTextMessage, sendVideoMessage } from "~/domain/z-api/zapi.service";

type ActionData = {
  intent: "send-text" | "send-video";
  ok: boolean;
  result?: any;
  error?: { message: string; details?: any };
};

function toJsonError(error: any): ActionData["error"] {
  if (error instanceof ValidationError) {
    return { message: error.message };
  }
  if (error instanceof ZApiError) {
    return {
      message: error.message,
      details: error.body ?? null,
    };
  }
  return { message: error?.message || "Unexpected error" };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");

  try {
    if (intent === "send-text") {
      const phone = String(form.get("phone") || "");
      const message = String(form.get("message") || "");
      const result = await sendTextMessage({ phone, message });
      return json<ActionData>({ intent: "send-text", ok: true, result });
    }

    if (intent === "send-video") {
      const phone = String(form.get("phone") || "");
      const video = String(form.get("video") || "");
      const caption = String(form.get("caption") || "");
      const delayMessageRaw = form.get("delayMessage");
      const viewOnce = form.get("viewOnce") === "on";

      const delayMessage =
        delayMessageRaw !== null && delayMessageRaw !== ""
          ? Number(delayMessageRaw)
          : undefined;

      const result = await sendVideoMessage({
        phone,
        video,
        caption: caption || undefined,
        delayMessage,
        viewOnce,
      });

      return json<ActionData>({ intent: "send-video", ok: true, result });
    }

    return json<ActionData>({
      intent: intent as ActionData["intent"],
      ok: false,
      error: { message: "Invalid intent" },
    });
  } catch (error: any) {
    return json<ActionData>({
      intent: intent as ActionData["intent"],
      ok: false,
      error: toJsonError(error),
    });
  }
}

export default function AdminZApiPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const feedbackLabel = useMemo(() => {
    if (!actionData) return null;
    const prefix = actionData.intent === "send-video" ? "Vídeo" : "Texto";
    const status = actionData.ok ? "enviado" : "erro";
    return `${prefix}: ${status}`;
  }, [actionData]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Z-API Playground</h1>
        <p className="text-sm text-gray-600">
          Envie mensagens de texto e vídeo pela Z-API e veja a resposta bruta para debug.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Enviar texto</h2>
          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="_intent" value="send-text" />
            <label className="flex flex-col gap-1 text-sm">
              Telefone (E.164 sem +)
              <input
                name="phone"
                required
                placeholder="5544999999999"
                className="rounded border px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mensagem
              <textarea
                name="message"
                required
                className="h-28 rounded border px-3 py-2 text-base"
                placeholder="Olá!"
              />
            </label>
            <button
              type="submit"
              name="send-text"
              value="true"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmitting ? "Enviando..." : "Enviar mensagem de texto"}
            </button>
          </Form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Enviar vídeo</h2>
          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="_intent" value="send-video" />
            <label className="flex flex-col gap-1 text-sm">
              Telefone (E.164 sem +)
              <input
                name="phone"
                required
                placeholder="5544999999999"
                className="rounded border px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              URL do vídeo
              <input
                name="video"
                required
                placeholder="https://..."
                className="rounded border px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Legenda (opcional)
              <input
                name="caption"
                placeholder="Legenda opcional"
                className="rounded border px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              delayMessage (segundos, opcional)
              <input
                name="delayMessage"
                type="number"
                min={0}
                step={1}
                placeholder="5"
                className="rounded border px-3 py-2 text-base"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="viewOnce" className="h-4 w-4" />
              viewOnce
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? "Enviando..." : "Enviar vídeo"}
            </button>
          </Form>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-medium">Resposta da API</h3>
          {feedbackLabel && (
            <span
              className={`text-xs font-semibold ${
                actionData?.ok ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {feedbackLabel}
            </span>
          )}
        </div>
        <div className="overflow-auto rounded border bg-gray-50 p-3 text-xs text-gray-800">
          <pre className="whitespace-pre-wrap break-all">
            {actionData
              ? JSON.stringify(actionData.error ? actionData.error : actionData.result, null, 2)
              : "Envie uma requisição para ver a resposta aqui."}
          </pre>
        </div>
      </section>
    </div>
  );
}
