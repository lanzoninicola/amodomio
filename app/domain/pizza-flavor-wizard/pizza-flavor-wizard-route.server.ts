import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import {
  createPizzaFlavor,
  loadPizzaFlavorWizardCatalog,
  type PizzaFlavorIngredientInput,
} from "./pizza-flavor-wizard.server";

export async function loader({}: LoaderFunctionArgs) {
  try {
    return ok(await loadPizzaFlavorWizardCatalog());
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") || "").trim();
    const baseCommercialText = String(formData.get("baseCommercialText") || "");
    const fillingCommercialText = String(
      formData.get("fillingCommercialText") || ""
    );
    const raw = JSON.parse(String(formData.get("ingredients") || "[]"));
    const variationCodesRaw = JSON.parse(
      String(formData.get("variationCodes") || "[]")
    );
    const ingredients: PizzaFlavorIngredientInput[] = Array.isArray(raw)
      ? raw
          .map((row) => ({
            itemId: String(row?.itemId || "").trim() || null,
            name: String(row?.name || "").trim(),
            section: row?.section === "base" ? "base" : "filling",
          }))
          .filter((row) => row.itemId || row.name)
      : [];
    const variationCodes = Array.isArray(variationCodesRaw)
      ? variationCodesRaw.map(String)
      : [];
    return ok({
      created: await createPizzaFlavor({
        name,
        ingredients,
        variationCodes,
        baseCommercialText,
        fillingCommercialText,
      }),
    });
  } catch (error) {
    const message =
      (error as Error)?.message || "Não foi possível criar o sabor";
    return badRequest({ message });
  }
}
