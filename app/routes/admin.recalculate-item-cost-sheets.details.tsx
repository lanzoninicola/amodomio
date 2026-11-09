import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getItemCostSheetRecalculationCostChanges } from "~/domain/costs/item-cost-sheet-bulk-recalculate.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const rootSheetId = String(url.searchParams.get("rootSheetId") || "").trim();

  if (!rootSheetId) {
    return json(
      { message: "Ficha técnica não informada.", costChanges: [] },
      400
    );
  }

  try {
    const costChanges = await getItemCostSheetRecalculationCostChanges(
      rootSheetId
    );

    return json({ costChanges });
  } catch (error) {
    console.error("Erro ao carregar insumos da ficha para recálculo", error);
    return json(
      {
        message: "Não foi possível carregar os insumos. Tente novamente.",
        costChanges: [],
      },
      500
    );
  }
}
