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
    const raw = JSON.parse(String(formData.get("ingredients") || "[]"));
    const ingredients: PizzaFlavorIngredientInput[] = Array.isArray(raw)
      ? raw
          .map((row) => ({
            itemId: String(row?.itemId || "").trim() || null,
            name: String(row?.name || "").trim(),
            section: row?.section === "base" ? "base" : "filling",
          }))
          .filter((row) => row.itemId || row.name)
      : [];
    return ok({ created: await createPizzaFlavor({ name, ingredients }) });
  } catch (error) {
    const message =
      (error as Error)?.message || "Não foi possível criar o sabor";
    return badRequest({ message });
  }
}
