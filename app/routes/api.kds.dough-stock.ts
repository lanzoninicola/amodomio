import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import { getEffectiveRoles } from "~/domain/auth/user-access";
import { defaultSizeCounts } from "~/domain/kds/types";
import {
  getAvailableDoughSizes,
  getDoughStock,
  getPreviousDoughStock,
  saveDoughStock,
  notifyTodayDoughStockSavedByWhatsapp,
} from "~/domain/kds/dough-stock.server";
import {
  todayLocalYMD,
  ymdToDateInt,
  ymdToUtcNoon,
} from "~/domain/kds/utils/date";
import {
  enforceRateLimit,
  handleRouteError,
} from "~/domain/z-api/route-helpers.server";
import { readJsonBody } from "~/domain/z-api/security.server";

async function access(request: Request) {
  const { user } = await getAuthenticatedBearerSession(request);
  if (!user) return json({ message: "Sessão expirada." }, { status: 401 });
  if (
    !getEffectiveRoles(user).some((role) =>
      ["admin", "kdsOperator"].includes(role)
    )
  )
    return json(
      { message: "Perfil sem acesso ao estoque de massa." },
      { status: 403 }
    );
  return null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = ymdToUtcNoon(value);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const denied = await access(request);
  if (denied) return denied;
  const date = new URL(request.url).searchParams.get("date") ?? todayLocalYMD();
  if (!validDate(date))
    return json({ message: "Data inválida." }, { status: 400 });
  const [sizes, stock, previousStock] = await Promise.all([
    getAvailableDoughSizes(),
    getDoughStock(ymdToDateInt(date)),
    getPreviousDoughStock(ymdToDateInt(date)),
  ]);
  return json(
    { date, today: todayLocalYMD(), sizes, stock, previousStock },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ message: "Método não permitido." }, { status: 405 });
  const denied = await access(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request, 4096);
    if (
      !validDate(body?.date) ||
      !["save", "reset", "sendWhatsapp"].includes(body?.intent)
    )
      return json({ message: "Data ou operação inválida." }, { status: 400 });
    const counts = defaultSizeCounts();
    if (body.intent !== "reset") {
      for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
        const value = body.counts?.[key];
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 0
        )
          return json(
            { message: "Informe quantidades inteiras e não negativas." },
            { status: 400 }
          );
        counts[key] = value;
      }
    }
    if (body.intent === "sendWhatsapp") {
      if (body.date !== todayLocalYMD())
        return json(
          {
            message: "Envio do WhatsApp habilitado apenas para a data de hoje.",
          },
          { status: 400 }
        );
      const limited = enforceRateLimit(request, 10, "dough-stock-whatsapp");
      if (limited) return limited;
      const snapshot = {
        base: counts,
        adjustment: counts,
        effective: counts,
        adjustmentMode: "override" as const,
      };
      const result = await notifyTodayDoughStockSavedByWhatsapp({
        dateStr: body.date,
        snapshot,
      });
      return json({
        ok: result.ok,
        message: result.detail,
        whatsappSent: result.attempted && !result.skipped && result.ok,
      });
    }
    const stock = await saveDoughStock(
      ymdToDateInt(body.date),
      ymdToUtcNoon(body.date),
      counts,
      counts
    );
    return json({
      ok: true,
      stock,
      message: "Estoque atualizado.",
      whatsappSent: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
