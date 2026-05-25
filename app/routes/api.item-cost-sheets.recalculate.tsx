import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { recalculateItemCostSheetsInBulk } from "~/domain/costs/item-cost-sheet-bulk-recalculate.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError, unauthorized } from "~/utils/http-response.server";

type RecalculatePayload = {
  itemCostSheetId: string;
  rootSheetIds: string[];
  redirectTo: string;
};

function normalizeRootSheetIds(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

async function readPayload(request: Request): Promise<RecalculatePayload> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return {
      itemCostSheetId: String(body?.itemCostSheetId || "").trim(),
      rootSheetIds: normalizeRootSheetIds(body?.rootSheetIds),
      redirectTo: String(body?.redirectTo || "").trim(),
    };
  }

  const formData = await request.formData();
  return {
    itemCostSheetId: String(formData.get("itemCostSheetId") || "").trim(),
    rootSheetIds: normalizeRootSheetIds(formData.get("rootSheetIds")),
    redirectTo: String(formData.get("redirectTo") || "").trim(),
  };
}

function getSafeRedirectTo(request: Request, redirectTo: string) {
  const normalizedRedirectTo = String(redirectTo || "").trim();
  if (!normalizedRedirectTo) return "";

  const currentUrl = new URL(request.url);
  try {
    const targetUrl = new URL(normalizedRedirectTo, currentUrl.origin);
    if (targetUrl.origin !== currentUrl.origin) return "";
    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  } catch {
    return "";
  }
}

async function resolveRootSheetIds(payload: RecalculatePayload) {
  const db = prismaClient as any;
  const explicitRootSheetIds = payload.rootSheetIds;
  if (explicitRootSheetIds.length > 0) return explicitRootSheetIds;

  const itemCostSheetId = payload.itemCostSheetId;
  if (!itemCostSheetId) return [];

  const sheet = await db.itemCostSheet.findUnique({
    where: { id: itemCostSheetId },
    select: { id: true, baseItemCostSheetId: true },
  });

  if (!sheet) return [];
  return [String(sheet.baseItemCostSheetId || sheet.id)];
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method.toUpperCase() !== "POST") {
      return badRequest("Método inválido");
    }

    const user = await authenticator.isAuthenticated(request);
    if (!user) return unauthorized("Não autorizado");

    const payload = await readPayload(request);
    const rootSheetIds = await resolveRootSheetIds(payload);
    if (rootSheetIds.length === 0) {
      return badRequest("Informe ao menos uma ficha técnica para recalcular");
    }

    const bulk = await recalculateItemCostSheetsInBulk(rootSheetIds);
    const redirectTo = getSafeRedirectTo(request, payload.redirectTo);
    if (redirectTo) return redirect(redirectTo);

    return ok({
      message: `${bulk.results.length} ficha(s) processada(s)`,
      bulk,
    });
  } catch (error) {
    return serverError(error);
  }
}
