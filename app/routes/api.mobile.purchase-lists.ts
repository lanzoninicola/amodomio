import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import { readJsonBody } from "~/domain/z-api/security.server";
import {
  createMobilePurchaseList,
  getMobilePurchaseList,
  listMobilePurchaseCatalog,
  listMobilePurchaseLists,
  updateMobilePurchaseListItem,
} from "~/domain/purchase/purchase-shopping-list.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await getAuthenticatedBearerSession(request);
  if (!user) return json({ message: "Sessão expirada." }, { status: 401 });
  const listId = new URL(request.url).searchParams.get("listId");
  const headers = { "Cache-Control": "no-store" };
  if (listId) {
    const list = await getMobilePurchaseList(listId);
    return list
      ? json({ list }, { headers })
      : json({ message: "Lista não encontrada." }, { status: 404 });
  }
  const [catalog, lists] = await Promise.all([
    listMobilePurchaseCatalog(),
    listMobilePurchaseLists(),
  ]);
  return json({ catalog, lists }, { headers });
}
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ message: "Método não permitido." }, { status: 405 });
  const { user } = await getAuthenticatedBearerSession(request);
  if (!user) return json({ message: "Sessão expirada." }, { status: 401 });
  try {
    const body = await readJsonBody(request, 65536);
    if (
      body.intent === "create" &&
      typeof body.name === "string" &&
      Array.isArray(body.items) &&
      body.items.every(
        (item: any) =>
          item &&
          typeof item.itemId === "string" &&
          typeof item.unit === "string" &&
          typeof item.quantity === "number"
      )
    ) {
      const created = await createMobilePurchaseList(
        body.name.trim(),
        body.items
      );
      return json({ list: await getMobilePurchaseList(created.id) });
    }
    if (
      body.intent === "toggle" &&
      typeof body.listId === "string" &&
      typeof body.listItemId === "string" &&
      typeof body.purchased === "boolean"
    ) {
      const list = await getMobilePurchaseList(body.listId);
      const item = list?.Items.find((row: any) => row.id === body.listItemId);
      if (!item)
        return json({ message: "Produto não encontrado." }, { status: 404 });
      await updateMobilePurchaseListItem({
        listId: list.id,
        listItemId: item.id,
        purchased: body.purchased,
        supplierId: item.supplierId,
      });
      return json({ list: await getMobilePurchaseList(list.id) });
    }
    return json({ message: "Dados inválidos." }, { status: 400 });
  } catch (error) {
    console.error("Mobile purchase lists", error);
    return json(
      {
        message: "Não foi possível salvar. Revise os dados e tente novamente.",
      },
      { status: 400 }
    );
  }
}
