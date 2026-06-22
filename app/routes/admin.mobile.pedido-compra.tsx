import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Admin Mobile | Pedido de compra" },
];

export default function AdminMobilePedidoCompraLayout() {
  return <Outlet />;
}
