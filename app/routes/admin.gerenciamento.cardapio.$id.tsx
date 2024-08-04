import { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation, useParams, useSearchParams } from "@remix-run/react";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { lastUrlSegment, urlAt } from "~/utils/url";

export const meta: V2_MetaFunction = ({ data }) => {
    const item: MenuItemWithAssociations = data?.payload?.item

    return [
        { title: item?.name || "Nome não encontrado" },
    ];
};

const navigation = [
    { name: 'Principal', href: 'main' },
    { name: 'Venda', href: 'venda/prices' },
    { name: 'Tags', href: 'tags' },
]



export async function loader({ request }: LoaderArgs) {
    const itemId = urlAt(request.url, -2)

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }

    const [err, item] = await prismaIt(menuItemPrismaEntity.findById(itemId));


    if (err) {
        return serverError(err);
    }

    return ok({ item })

}


export default function SingleCardapioItem() {

    const loaderData = useLoaderData<typeof loader>()
    const item = loaderData.payload?.item

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    if (loaderData.status > 399) {
        toast({
            title: "Erro",
            description: loaderData.message,
        })
    }


    return (
        <div className="flex flex-col gap-4">

            <div className="h-full w-full rounded-[inherit]" >
                <div style={{
                    minWidth: '100%',
                    display: 'table'
                }}>
                    <div className="flex justify-between">
                        <h1 className="text-2xl font-semibold text-muted-foreground col-span-2">{item?.name}</h1>
                        <div className="flex items-center col-span-6">

                            {
                                navigation.map((item) => (
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


