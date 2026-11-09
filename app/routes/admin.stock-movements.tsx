import type { MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';

export const meta: MetaFunction = () => [{ title: 'Admin | Movimentações de estoque' }];

export default function AdminStockMovementsLayoutRoute() {
  return <Outlet />;
}
