import { redirect, type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Vendas | Gestão de preços" },
];

export function loader() {
  return redirect("/admin/vendas/sell-price-management/faixas-lucro");
}
