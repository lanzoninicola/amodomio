import { Outlet, useLocation, useOutletContext } from "@remix-run/react";
import { Separator } from "~/components/ui/separator";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { lastUrlSegment } from "~/utils/url";

const navigation = [
    { name: 'Preços', href: 'prices' },
    { name: 'Histórico', href: 'historico' },
]

export default function SingleMenuItemVenda() {
    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)


    return (

        <div className="flex flex-col">

            <div className="flex items-center col-span-6">

                {
                    navigation.map((navItem) => (
                        <MenuItemNavLink key={navItem.name} to={navItem.href} isActive={activeTab === navItem.href}>
                            {navItem.name}
                        </MenuItemNavLink>
                    ))
                }

            </div>

            <Separator className="my-1" />

            <Outlet key={location.pathname} />
        </div>
    )
}