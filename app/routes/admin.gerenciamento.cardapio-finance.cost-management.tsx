import { Outlet, useLoaderData, useLocation, useOutletContext } from "@remix-run/react"
import { GerenciamentoCardapioOutletContext } from "./admin.gerenciamento.cardapio"
import { Separator } from "~/components/ui/separator"
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server"
import { MenuItemSize } from "@prisma/client"
import { ok } from "~/utils/http-response.server"
import { LoaderFunctionArgs } from "@remix-run/node"
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link"
import { lastUrlSegment } from "~/utils/url"
import { MenuItemTag } from "@prisma/client"
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server"
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server"
import { categoryPrismaEntity } from "~/domain/category/category.entity.server"
import { Category } from "~/domain/category/category.model.server"
import prismaClient from "~/lib/prisma/client.server"
import { prismaAll } from "~/lib/prisma/prisma-all.server"
import { badRequest } from "~/utils/http-response.server"
import Container from "~/components/layout/container/container"



export interface GerenciamentoCardapioCostsOutletContext {
    categories: Category[],
    items: MenuItemWithAssociations[],
    tags: MenuItemTag[],
    itemSizes: MenuItemSize[]
}

export async function loader({ request }: LoaderFunctionArgs) {
    const [categories, items, tags, itemSizes] = await prismaAll([
        categoryPrismaEntity.findAll(),
        menuItemPrismaEntity.findAll({
            option: {
                sorted: true,
                direction: "asc"
            }
        }, {
            imageTransform: true,
            imageScaleWidth: 64,
        }),
        menuItemTagPrismaEntity.findAll(),
        prismaClient.menuItemSize.findMany()
    ])

    if (categories[0] || items[0] || tags[0] || itemSizes[0]) {
        return badRequest({ message: "Ocorreu um erro" })
    }

    return ok({
        categories: categories[1] as Category[],
        items: items[1] as MenuItemWithAssociations[],
        tags: tags[1] as MenuItemTag[],
        itemSizes: itemSizes[1] as MenuItemSize[]
    })
}

export default function GerenciamentoCardapioItemsCosts() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []
    const categories = loaderData?.payload.categories as Category[] || []
    const tags = loaderData?.payload.tags as MenuItemTag[] || []
    const itemSizes = loaderData?.payload.itemSizes || []

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    return (
        <Container>
            <div className="flex justify-between">
                <div className="flex justify-between">
                    <ul className="flex items-center ">
                        <span className="text-sm font-semibold tracking-wide mr-2">Tamanhos:</span>
                        {
                            itemSizes.map((sv: MenuItemSize) => (
                                <li key={sv.id}>
                                    <MenuItemNavLink to={sv.slug} isActive={activeTab === sv.slug}>
                                        {sv.name}
                                    </MenuItemNavLink>
                                </li>
                            ))
                        }

                    </ul>
                </div>
                <div>
                    cucu
                </div>
            </div>
            <Separator className="my-4" />
            <Outlet context={{
                items: items.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex),
                categories,
                tags,
                itemSizes
            }} />
        </Container>

    )

}





