import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const menuItemId = params.id;
  if (!menuItemId) return redirect("/admin/item-cost-sheets");
  return redirect("/admin/item-cost-sheets");
}

export default function AdminCardapioRecipeSheetsDeprecated() {
  return null;
}
