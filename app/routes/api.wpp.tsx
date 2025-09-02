// app/routes/api.wpp.tsx
import { json } from "@remix-run/node";
import { getQrCodeImage, sendTextMessage, startSession, statusSession } from "~/domain/bot/wpp.server";

export async function loader() {
  return json({ ok: true });
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const op = String(form.get("op") || "");
  try {
    if (op === "start") {
      const session = String(form.get("session") || "default");
      const r = await startSession(session);
      return json(r, { status: r.ok ? 200 : r.status || 500 });
    }
    if (op === "status") {
      const session = String(form.get("session") || "default");
      const r = await statusSession(session);
      return json(r, { status: r.ok ? 200 : r.status || 500 });
    }
    if (op === "qr") {
      const session = String(form.get("session") || "default");
      const r = await getQrCodeImage(session);
      return json(r, { status: r.ok ? 200 : r.status || 500 });
    }
    if (op === "send") {
      const session = String(form.get("session") || "default");
      const phone = String(form.get("phone") || "");
      const message = String(form.get("message") || "");
      const r = await sendTextMessage(session, phone, message);
      return json(r, { status: r.ok ? 200 : r.status || 500 });
    }
    return json({ ok: false, error: "op inválida" }, { status: 400 });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "erro" }, { status: 500 });
  }
}
