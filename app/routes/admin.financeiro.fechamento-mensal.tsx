import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Fechamento mensal | Admin" },
];

export default function AdminFinanceiroFechamentoMensalLayout() {
  return <Outlet />;
}
