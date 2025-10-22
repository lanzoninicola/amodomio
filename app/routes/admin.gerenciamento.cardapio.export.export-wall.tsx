import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, defer, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";

export async function loader({ request }: LoaderFunctionArgs) {

    // const categories = categoryPrismaEntity.findAll()
    const listFlat = menuItemPrismaEntity.findAll({
        option: {
            sorted: true,
            direction: "asc"
        }
    }, {
        imageTransform: true,
        imageScaleWidth: 64,
    })

    const data = Promise.all([listFlat]);

    return defer({ data });
}

export default function GerenciamentoCardapioExport() {
    const { data } = useLoaderData<typeof loader>();

    return (
        <Suspense fallback={
            <div className="flex justify-center items-center h-[150px]">
                <Loading color="black" />
            </div>
        }>
            <Await resolve={data}>
                {([listFlat]) => {



                    const items = listFlat.filter(i => i.visible === true)

                    console.log({ items })

                    if (!items.length) {
                        return (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-2xl text-gray-500">Nenhum item visível</div>
                            </div>
                        )
                    }

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
                                    {isFirstOfLetter && (
                                        <div className="flex items-center gap-x-2 bg-orange-200 mb-3 py-1 px-4">
                                            <span className="text-md">{`#`}</span>
                                            <span className="text-2xl font-semibold">{firstLetter}</span>
                                        </div>
                                    )}
                                    <div className="ml-2 font-semibold text-xl uppercase font-mono leading-none bg-red-50 py-2 px-1 mb-1">
                                        {item.name}
                                    </div>
                                    <div className="ml-2 text-xl leading-tight font-mono tracking-tight">
                                        {item.ingredients}
                                    </div>
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



                }}
            </Await>
        </Suspense>
    )

}