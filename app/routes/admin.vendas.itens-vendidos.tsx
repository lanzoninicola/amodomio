import { Outlet } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "Vendas | Itens vendidos" }];

export default function AdminVendasItensVendidosLayout() {
  return <Outlet />;
}
