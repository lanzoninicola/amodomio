import { Outlet, useLocation } from "@remix-run/react";




export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutlet() {
  const { pathname } = useLocation()


  return <Outlet key={pathname} />
}




