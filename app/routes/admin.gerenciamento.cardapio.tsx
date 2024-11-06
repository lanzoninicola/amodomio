import { scale } from "@cloudinary/url-gen/actions/resize";
import { MenuItemSizeVariation, MenuItemTag } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, MetaFunction, useLoaderData, useResolvedPath, useParams, useLocation } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { toast } from "~/components/ui/use-toast";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { Category } from "~/domain/category/category.model.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaAll } from "~/lib/prisma/prisma-all.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";

export interface GerenciamentoCardapioOutletContext {
    categories: Category[],
    items: MenuItemWithAssociations[],
    tags: MenuItemTag[],
    sizeVariations: MenuItemSizeVariation[]
}

export const meta: MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        { title: "Gerenciamento cardápio" },
    ];
};


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


export interface AdminCardapioOutletContext {
    categories: Category[]
    items: MenuItemWithAssociations[]
    tags: MenuItemTag[]
}

export default function AdminCardapioOutlet() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []
    const categories = loaderData?.payload.categories as Category[] || []
    const tags = loaderData?.payload.tags as MenuItemTag[] || []
    const sizeVariations = loaderData?.payload.sizeVariations || []

    if (loaderData?.status > 399) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
    }

    const location = useLocation()
    // console.log({ location })

    const isExportPage = location?.pathname === "/admin/gerenciamento/cardapio/export-wall" || location?.pathname === "/admin/gerenciamento/cardapio/export-wall-two"

    return (
        <Container className="mb-24">
            <div className={
                cn(
                    "w-full p-6 bg-muted mb-8 rounded-lg",
                    isExportPage && "hidden",
                )
            } >
                <div className="flex justify-between mb-4 items-start">
                    <div className="flex flex-col gap-4">
                        <h1 className="font-bold text-xl">Cardapio</h1>
                        <div className="flex gap-4 justify-between md:justify-start">
                            <Link to="new" className="py-2 px-4 rounded-md bg-black">
                                <span className=" text-white font-semibold">
                                    Novo item
                                </span>
                            </Link>
                            <Link to="/admin/gerenciamento/cardapio/export-wall" className="py-2 px-4 rounded-md border border-black hover:bg-black/10">
                                <span className="font-semibold">
                                    Imprimir para a parede
                                </span>
                            </Link>
                            <Link to="/admin/gerenciamento/cardapio-items-costs" className="py-2 px-4 rounded-md border border-black hover:bg-black/10">
                                <span className="font-semibold">
                                    Gerenciamento custos
                                </span>
                            </Link>
                        </div>

                    </div>
                    <Link to="/admin/gerenciamento/cardapio" className="mr-4">
                        <span className="text-sm underline">Voltar</span>
                    </Link>

                </div>

            </div>

            <Outlet context={{
                items: items.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex),
                categories,
                tags,
                sizeVariations
            }} />
        </Container>

    )

}