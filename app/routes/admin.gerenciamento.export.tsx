import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { LoaderArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { Separator } from "~/components/ui/separator";

export async function loader({ request }: LoaderArgs) {
    const env = process.env?.NODE_ENV

    // @ts-ignore
    const [errItems, items] = await prismaIt(menuItemPrismaEntity.findAll({
        where: {
            visible: true
        },
        option: {
            sorted: true,
            direction: "asc"
        },
        mock: env === "development"
    }))

    if (errItems) {
        return badRequest(errItems)
    }

    return ok({ items })

}

export default function GerenciamentoCardapioExport() {

    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []

    const sortedArray = items.sort((a, b) => a.name.localeCompare(b.name));
    const half = Math.ceil(sortedArray.length / 2);
    const firstColumn = sortedArray.slice(0, half);
    const secondColumn = sortedArray.slice(half);

    const renderColumn = (column: MenuItemWithAssociations[]) => {
        let currentLetter = '';
        return column.map((item, index) => {
            const firstLetter = item.name[0].toUpperCase();
            const isFirstOfLetter = firstLetter !== currentLetter;
            currentLetter = firstLetter;

            // item.ingredients contains Molho de tomate italiano replace with Molho de tomate
            item.ingredients = item.ingredients?.replace(/molho de tomate italiano/gi, "MT")
            item.ingredients = item.ingredients?.replace(/muçarela/gi, "MC")

            return (
                <div key={index} className="py-2">
                    {isFirstOfLetter &&
                        <>
                            <div className="text-2xl font-bold">{firstLetter}</div>
                            <Separator className="mb-2 bg-black" />
                        </>
                    }

                    <div className="ml-2 font-semibold text-[.85rem] uppercase mb-[0.05rem]">{item.name}</div>
                    <div className="ml-2 text-lg leading-tight">{item.ingredients}</div>
                </div>
            );
        });
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            <div>{renderColumn(firstColumn)}</div>
            <div>{renderColumn(secondColumn)}</div>
        </div>
    );
}