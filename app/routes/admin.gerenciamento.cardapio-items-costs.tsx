import { Outlet, useLoaderData, useLocation, useOutletContext } from "@remix-run/react"
import { GerenciamentoCardapioOutletContext } from "./admin.gerenciamento.cardapio"
import { Separator } from "~/components/ui/separator"
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server"
import { MenuItemSizeVariation } from "@prisma/client"
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
    sizeVariations: MenuItemSizeVariation[]
}

export async function loader({ request }: LoaderFunctionArgs) {
    const [categories, items, tags, sizeVariations] = await prismaAll([
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
        prismaClient.menuItemSizeVariation.findMany()
    ])


    if (categories[0] || items[0] || tags[0] || sizeVariations[0]) {
        return badRequest({ message: "Ocorreu um erro" })
    }

    return ok({
        categories: categories[1] as Category[],
        items: items[1] as MenuItemWithAssociations[],
        tags: tags[1] as MenuItemTag[],
        sizeVariations: sizeVariations[1] as MenuItemSizeVariation[]
    })
}

export default function GerenciamentoCardapioItemsCosts() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []
    const categories = loaderData?.payload.categories as Category[] || []
    const tags = loaderData?.payload.tags as MenuItemTag[] || []
    const sizeVariations = loaderData?.payload.sizeVariations || []

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    return (
        <Container>
            <div className="h-full w-full rounded-[inherit]" >
                <div style={{
                    minWidth: '100%',
                    display: 'table'
                }}>
                    <div className="flex justify-between">
                        <ul className="flex items-center ">
                            <span className="text-sm font-semibold tracking-wide mr-2">Tamanhos:</span>
                            {
                                sizeVariations.map((sv: MenuItemSizeVariation) => (
                                    <li key={sv.id}>
                                        <MenuItemNavLink to={sv.slug} isActive={activeTab === sv.slug}>
                                            {sv.name}
                                        </MenuItemNavLink>
                                    </li>
                                ))
                            }

                        </ul>
                    </div>
                </div>
                <Separator className="my-4" />
            </div >
            <Outlet context={{
                items: items.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex),
                categories,
                tags,
                sizeVariations
            }} />
        </Container>

    )

}





