import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/admin/item-cost-sheets/${params.id}/dados-gerais`);
}

export default function AdminItemCostSheetIndexRedirect() {
  return null;
}
