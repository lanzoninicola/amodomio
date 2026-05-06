import { Outlet, useLocation } from "@remix-run/react";
import { Separator } from "~/components/ui/separator";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { lastUrlSegment } from "~/utils/url";

const menuItemNavigation = [
    { name: 'Principal', href: 'main' },
    { name: 'Galeria', href: 'images' },
    { name: 'Venda', href: 'venda/prices' },
    { name: 'Tags', href: 'tags' },
    { name: 'Custos', href: 'costs' }
]


export default function SingleCardapioItem() {

    // const loaderData = useLoaderData<typeof loader>()
    // const item = loaderData.payload?.item

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    // if (loaderData.status > 399) {
    //     toast({
    //         title: "Erro",
    //         description: loaderData.message,
    //     })
    // }


    return (
        <div className="flex flex-col gap-4">

            <div className="h-full w-full rounded-[inherit]" >
                <div style={{
                    minWidth: '100%',
                    display: 'table'
                }}>
                    <div className="flex justify-between">
                        {/* <h1 className="text-2xl font-semibold text-muted-foreground col-span-2">{item?.name}</h1> */}
                        <div className="flex items-center col-span-6">

                            {
                                menuItemNavigation.map((item) => (
                                    <MenuItemNavLink key={item.name} to={item.href} isActive={activeTab === item.href}>
                                        {item.name}
                                    </MenuItemNavLink>
                                ))
                            }

                        </div>
                    </div>
                </div>
                <Separator className="my-4" />
            </div >


            <Outlet />

        </div>
    );
}
