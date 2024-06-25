import { LoaderArgs } from "@remix-run/node";
import { Link, Outlet, V2_MetaFunction, useActionData, useLoaderData } from "@remix-run/react";
import { AlertCircle } from "lucide-react";
import Container from "~/components/layout/container/container";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { toast } from "~/components/ui/use-toast";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { Category } from "~/domain/category/category.model.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/menu-item/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Cardápio - Gerençiamento",
        }
    ];
};


export async function loader({ request }: LoaderArgs) {
    const [errCategories, categories] = await prismaIt(categoryPrismaEntity.findAll())

    if (errCategories) {
        return badRequest(errCategories)
    }

    const [errItems, items] = await prismaIt(menuItemPrismaEntity.findAll())



    if (errItems) {
        return badRequest(errItems)
    }

    return ok({ categories, items })

}


export interface AdminCardapioOutletContext {
    categories: Category[]
    items: MenuItemWithAssociations[]
}

export default function AdminCardapioOutlet() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []
    const categories = loaderData?.payload.categories as Category[] || []

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
                items,
                categories
            }} />
        </Container>

    )

}