import { redirect } from "@remix-run/node";

export function loader() {
  return redirect("/admin/vendas/sell-price-management/faixas-lucro");
}
