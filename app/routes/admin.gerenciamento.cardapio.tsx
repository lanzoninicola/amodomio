import { MenuItemTag } from "@prisma/client";
import { Link, Outlet, MetaFunction, useLocation } from "@remix-run/react";
import { ChevronRight, CircleArrowOutUpRight, Printer, SquarePlus } from "lucide-react";
import Container from "~/components/layout/container/container";
import { Separator } from "~/components/ui/separator";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { Category } from "~/domain/category/category.model.server";
import { PizzaSizeVariation } from "~/domain/pizza/pizza.entity.server";
import { cn } from "~/lib/utils";
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


// export async function loader({ request }: LoaderFunctionArgs) {

//     // https://github.com/remix-run/remix/discussions/6149

//     const categories = categoryPrismaEntity.findAll()
//     const listGroupedByCategory = menuItemPrismaEntity.findAllGroupedByCategory({
//         option: {
//             sorted: true,
//             direction: "asc"
//         }
//     }, {
//         imageTransform: true,
//         imageScaleWidth: 64,
//     })
//     const tags = menuItemTagPrismaEntity.findAll()
//     const sizeVariations = prismaClient.menuItemSize.findMany()

//     const data = Promise.all([categories, listGroupedByCategory, tags, sizeVariations]);

//     return defer({ data });
// }


export interface AdminCardapioOutletContext {
    categories: Category[]
    listGroupedByCategory?: { category: Category["name"], menuItems: MenuItemWithAssociations[] }[]
    tags: MenuItemTag[],
    sizeVariations: PizzaSizeVariation[]
}

export default function AdminCardapioOutlet() {

    // const {
    //     data,
    // } = useLoaderData<typeof loader>();


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



        <Container className="mb-24" fullWidth={true} >
            <div className={
                cn(
                    "flex flex-col mb-4",
                    isExportPage && "hidden",
                )
            }>

                <div className="flex justify-between items-center">
                    <div className="flex items-center">
                        <ChevronRight size={14} />
                        <h1 className="font-semibold text-sm text-muted-foreground">Gerenciamento Cardápio</h1>
                    </div>

                    <Link to="/admin/gerenciamento/cardapio/main/list" >
                        <span className="text-[12px] underline uppercase tracking-wider">Voltar para a lista</span>
                    </Link>
                </div>

            </div>


            <Outlet />

        </Container>




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
                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-2">
                    <span className="uppercase font-semibold text-xs tracking-wide">Publicados</span>
                    <span className="text-xl text-muted-foreground">{publicados}</span>
                </div>
                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-2">
                    <span className="uppercase font-semibold text-xs tracking-wide">Invisiveis</span>
                    <span className="text-xl text-muted-foreground">{invisivels}</span>
                </div>

                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-2">
                    <span className="uppercase font-semibold text-xs tracking-wide">Sem Imagem</span>
                    <span className="text-xl text-muted-foreground">{semImagem}</span>
                </div>
                <div className="flex flex-col gap-2 justify-center items-center mb-2 md:col-span-2 border rounded-md p-2">
                    <span className="uppercase font-semibold text-xs tracking-wide">Futuro lançamento</span>
                    <span className="text-xl text-muted-foreground">{futuroLançamento}</span>
                </div>
            </div>



        </div>

    )
}