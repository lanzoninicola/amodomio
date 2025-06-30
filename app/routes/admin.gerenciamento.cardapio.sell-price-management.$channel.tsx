import { MenuItemSellingChannel } from "@prisma/client";
import { Outlet, useLocation } from "@remix-run/react";

import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { LoggedUser } from "~/domain/auth/types.server";




export interface AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext {
  items: MenuItemWithSellPriceVariations[]
  sellingChannel: MenuItemSellingChannel
  user: LoggedUser
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutlet() {
  const { pathname } = useLocation()


  return <Outlet key={pathname} />
}




