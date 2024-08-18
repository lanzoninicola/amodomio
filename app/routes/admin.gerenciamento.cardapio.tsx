import { scale } from "@cloudinary/url-gen/actions/resize";
import { MenuItemTag } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, MetaFunction, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { toast } from "~/components/ui/use-toast";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { Category } from "~/domain/category/category.model.server";
import { prismaAll } from "~/lib/prisma/prisma-all.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";

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

    const [categories, items, tags] = await prismaAll([
        categoryPrismaEntity.findAll(),
        menuItemPrismaEntity.findAll({}, {
            imageTransform: true,
            imageScaleWidth: 64
        }),
        menuItemTagPrismaEntity.findAll()
    ])


    if (categories[0] || items[0] || tags[0]) {
        return badRequest({ message: "Ocorreu um erro" })
    }

    return ok({
        categories: categories[1] as Category[],
        items: items[1] as MenuItemWithAssociations[],
        tags: tags[1] as MenuItemTag[],
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

    if (loaderData?.status > 399) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
    }

    return (
        <Container className="mb-24">
            <div className="w-full p-6 bg-muted mb-8 rounded-lg" >
                <div className="flex justify-between mb-4 items-start">
                    <div className="flex flex-col gap-4">
                        <h1 className="font-bold text-xl">Cardapio</h1>
                        <div className="flex gap-4 justify-between md:justify-start">
                            <Link to="new" className="py-2 px-4 rounded-md bg-black">
                                <span className=" text-white font-semibold">
                                    Novo item
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
                tags
            }} />
        </Container>

    )

}