import { scale } from "@cloudinary/url-gen/actions/resize";
import { MenuItemTag } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, MetaFunction, useLoaderData, useResolvedPath, useParams, useLocation, defer, Await } from "@remix-run/react";
import { Suspense } from "react";
import Container from "~/components/layout/container/container";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { Category } from "~/domain/category/category.model.server";
import { PizzaSizeVariation } from "~/domain/pizza/pizza.entity.server";
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
    sizeVariations: PizzaSizeVariation[]
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

    // https://github.com/remix-run/remix/discussions/6149

    const categories = categoryPrismaEntity.findAll()
    const listGroupedByCategory = menuItemPrismaEntity.findAllGroupedByCategory({
        option: {
            sorted: true,
            direction: "asc"
        }
    }, {
        imageTransform: true,
        imageScaleWidth: 64,
    })
    const tags = menuItemTagPrismaEntity.findAll()
    const sizeVariations = prismaClient.menuItemSize.findMany()

    const data = Promise.all([categories, listGroupedByCategory, tags, sizeVariations]);

    return defer({ data });
}


export interface AdminCardapioOutletContext {
    categories: Category[]
    listGroupedByCategory?: { category: Category["name"], menuItems: MenuItemWithAssociations[] }[]
    tags: MenuItemTag[],
    sizeVariations: PizzaSizeVariation[]
}

export default function AdminCardapioOutlet() {

    const {
        data,
    } = useLoaderData<typeof loader>();


    // const loaderData = useLoaderData<typeof loader>()
    // const items = loaderData?.payload.items as { category: Category["name"], menuItems: MenuItemWithAssociations[] }[] || []
    // const categories = loaderData?.payload.categories as Category[] || []
    // const tags = loaderData?.payload.tags as MenuItemTag[] || []
    // const sizeVariations = loaderData?.payload.sizeVariations || []



    // if (loaderData?.status > 399) {
    //     toast({
    //         title: "Erro",
    //         description: loaderData?.message,
    //     })
    // }

    const location = useLocation()
    // console.log({ location })
    const activeTab = lastUrlSegment(location.pathname)


    const isExportPage = location?.pathname === "/admin/gerenciamento/cardapio/export-wall" || location?.pathname === "/admin/gerenciamento/cardapio/export-wall-two"

    return (


        <Suspense fallback={<Loading />}>
            <Await resolve={data}>
                {([categories, listGroupedByCategory, tags, sizeVariations]) => {


                    return (
                        <Container className="mb-24">
                            <div className={
                                cn(
                                    "flex flex-col",
                                    isExportPage && "hidden",
                                )
                            }>

                                <div className="w-full p-6 bg-muted mb-8 rounded-lg" >
                                    <div className="flex justify-between mb-4 items-start">
                                        <div className="flex flex-col gap-4">
                                            <h1 className="font-bold text-xl">Cardapio</h1>
                                            <div className="flex flex-col md:grid md:grid-cols-6 gap-2 text-sm">
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
                                                <Link to="/admin/gerenciamento/cardapio-finance/cost-management" className="py-2 px-4 rounded-md border border-black hover:bg-black/10">
                                                    <span className="font-semibold">
                                                        Gestão custos
                                                    </span>
                                                </Link>
                                                <Link to="/admin/gerenciamento/cardapio-finance/sales-management" className="py-2 px-4 rounded-md border border-black hover:bg-black/10">
                                                    <span className="font-semibold">
                                                        Gestão preços de venda
                                                    </span>
                                                </Link>
                                            </div>

                                        </div>
                                        <Link to="/admin/gerenciamento/cardapio" className="mr-4">
                                            <span className="text-sm underline">Voltar</span>
                                        </Link>

                                    </div>
                                </div>

                                <div className="flex flex-col gap-6 mb-4">
                                    {/** @ts-ignore */}
                                    <CardapioAdminStats listGroupedByCategory={listGroupedByCategory} />

                                    <div className="flex gap-4 items-center">
                                        <MenuItemNavLink to={"main"} isActive={activeTab === "main"}>
                                            <span>Lista</span>
                                        </MenuItemNavLink>
                                        <MenuItemNavLink to={"cost-management"} isActive={activeTab === "cost-management"}>
                                            Gerenciamento custos
                                        </MenuItemNavLink>

                                        <MenuItemNavLink to={"sell-price-management"} isActive={activeTab === "sell-price-management"}>
                                            Calculo preço de vendas
                                        </MenuItemNavLink>
                                    </div>
                                </div>

                                <Separator className="mb-8" />

                            </div>


                            <Outlet context={{
                                listGroupedByCategory,
                                categories,
                                tags,
                                sizeVariations,


                            }} />

                        </Container>

                    )
                }}
            </Await>
        </Suspense>




    )

}


interface CardapioAdminStatsProps {
    listGroupedByCategory: { category: Category["name"], menuItems: MenuItemWithAssociations[] }[]
}


function CardapioAdminStats({ listGroupedByCategory }: CardapioAdminStatsProps) {

    console.log({ listGroupedByCategory })


    const publicados = listGroupedByCategory
        .map(category =>
            category.menuItems
                .filter(menuItem => menuItem.visible === true)
                .length
        )
        .reduce((sum, count) => sum + count, 0);


    const invisivels = listGroupedByCategory
        .map(category =>
            category.menuItems
                .filter(menuItem => menuItem.visible === false)
                .length
        )
        .reduce((sum, count) => sum + count, 0);

    const semImagem = listGroupedByCategory
        .map(category =>
            category.menuItems
                .filter(menuItem => menuItem.imageId === null)
                .length
        )
        .reduce((sum, count) => sum + count, 0);

    const futuroLançamento = listGroupedByCategory
        .map(category =>
            category.menuItems
                .filter(menuItem => menuItem.tags?.all?.includes("futuro-lançamento"))
                .length
        )
        .reduce((sum, count) => sum + count, 0);


    return (

        <div className="flex flex-col gap-4 ">
            <div className="grid grid-cols-2 md:grid-cols-8  gap-2 md:gap-4">
                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Publicados</span>
                    <span className="text-3xl text-muted-foreground">{publicados}</span>
                </div>
                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Invisiveis</span>
                    <span className="text-3xl text-muted-foreground">{invisivels}</span>
                </div>

                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Sem Imagem</span>
                    <span className="text-3xl text-muted-foreground">{semImagem}</span>
                </div>
                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Futuro lançamento</span>
                    <span className="text-3xl text-muted-foreground">{futuroLançamento}</span>
                </div>
            </div>



        </div>

    )
}