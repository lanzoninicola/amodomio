import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import { getEffectiveRoles } from "~/domain/auth/user-access";
import { readJsonBody } from "~/domain/z-api/security.server";

const type = "kds-kitchen-message";
const status = "kds-pending";
async function access(request: Request) {
  const { user } = await getAuthenticatedBearerSession(request);
  if (!user) return json({ message: "Sessão expirada." }, { status: 401 });
  if (
    !getEffectiveRoles(user).some((role) =>
      ["admin", "kdsOperator"].includes(role)
    )
  )
    return json({ message: "Perfil sem acesso ao KDS." }, { status: 403 });
  return null;
}
export async function loader({ request }: LoaderFunctionArgs) {
  const denied = await access(request);
  if (denied) return denied;
  const messages = await prisma.adminActionNotification.findMany({
    where: {
      type,
      status,
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    },
    select: { id: true, description: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
  });
  return json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ message: "Método não permitido." }, { status: 405 });
  const denied = await access(request);
  if (denied) return denied;
  const rate = restApi.rateLimitCheck(request, { bucket: "kds-messages-send" });
  if (!rate.success)
    return json(
      { message: "Aguarde um momento e tente novamente." },
      { status: 429 }
    );
  let body;
  try {
    body = await readJsonBody(request, 4096);
  } catch {
    return json({ message: "Mensagem inválida." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return json({ message: "Mensagem inválida." }, { status: 400 });
  if (body.intent === "acknowledge" && typeof body.id === "string") {
    await prisma.adminActionNotification.updateMany({
      where: { id: body.id, type, status },
      data: { status: "resolved", resolvedAt: new Date() },
    });
    return json({ ok: true });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (
    body.intent !== "send" ||
    !text ||
    text.length > 500 ||
    typeof body.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.id)
  )
    return json(
      { message: "Escreva uma mensagem de até 500 caracteres." },
      { status: 400 }
    );
  // A stable client ID makes retries safe after a lost response.
  await prisma.adminActionNotification.upsert({
    where: { key: `${type}:${body.id}` },
    update: {},
    create: {
      key: `${type}:${body.id}`,
      type,
      status,
      title: "Aviso do atendimento",
      description: text,
    },
  });
  return json({ ok: true });
}
