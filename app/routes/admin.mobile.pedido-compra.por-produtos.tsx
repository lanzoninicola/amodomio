import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Admin Mobile | Lista de compras" },
];

export default function AdminMobilePedidoCompraPorProdutosLayout() {
  return <Outlet />;
}
