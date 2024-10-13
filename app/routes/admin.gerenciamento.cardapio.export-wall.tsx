import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { Separator } from "~/components/ui/separator";
import { GerenciamentoCardapioOutletContext } from "./admin.gerenciamento.cardapio";


export default function GerenciamentoCardapioExport() {


    const outletContext = useOutletContext<GerenciamentoCardapioOutletContext>()

    const allItems = outletContext?.items || []
    const items = allItems.filter(i => i.visible === true)

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
                            <div className="flex items-center gap-x-2 border-b border-b-black mb-4" >
                                <span className="text-md">{`#`}</span>
                                <span className="text-2xl font-semibold">{firstLetter}</span>
                            </div>

                        </>
                    }

                    <div className="ml-2 font-semibold text-[1.15rem] uppercase font-mono leading-none">{item.name}</div>
                    <div className="ml-2 text-lg leading-tight font-mono tracking-tight">{item.ingredients}</div>
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