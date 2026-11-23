import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import { createFoodLabel, getLabelingSettings, listLabelingItems, listRecentFoodLabels, markFoodLabelPrint } from "~/domain/labeling/labeling.server";
import { readJsonBody } from "~/domain/z-api/security.server";

const reply = (data: unknown, status = 200) => json(data, { status, headers: { "Cache-Control": "no-store" } });

async function auth(request: Request) {
  const session = await getAuthenticatedBearerSession(request);
  if (!session.user) throw new Response("Sessão expirada.", { status: 401 });
  return session.user;
}

function failure(error: unknown) {
  if (error instanceof Response) return reply({ message: error.status === 401 ? "Sessão expirada." : "Requisição inválida." }, error.status);
  console.error("Mobile labels", error);
  return reply({ message: error instanceof Error ? error.message : "Não foi possível emitir a etiqueta." }, 400);
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await auth(request);
    const [items, labels, settings] = await Promise.all([listLabelingItems(), listRecentFoodLabels(), getLabelingSettings()]);
    return reply({ items, labels, settings });
  } catch (error) { return failure(error); }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return reply({ message: "Método não permitido." }, 405);
  try {
    const user = await auth(request);
    const body = await readJsonBody(request, 16384) as Record<string, unknown>;
    if (body.intent === "create") {
      const label = await createFoodLabel({
        itemId: String(body.itemId || ""), copies: Number(body.copies) || 1,
        operatorUserId: user.id, operatorName: user.name || user.username,
      });
      return reply({ label, settings: await getLabelingSettings() }, 201);
    }
    if (body.intent === "print-result") {
      const label = await markFoodLabelPrint(String(body.id || ""), body.printed === true,
        typeof body.error === "string" ? body.error : undefined);
      return reply({ label });
    }
    return reply({ message: "Ação inválida." }, 400);
  } catch (error) { return failure(error); }
}
