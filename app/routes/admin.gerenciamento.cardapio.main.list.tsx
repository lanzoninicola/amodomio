import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, Outlet, defer, useLoaderData } from "@remix-run/react";
import { Columns, List } from "lucide-react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ request }: LoaderFunctionArgs) {

    // https://github.com/remix-run/remix/discussions/6149

    // const categories = categoryPrismaEntity.findAll()
    const listGroupedByCategory = menuItemPrismaEntity.findAllGroupedByCategory({
        option: {
            sorted: true,
            direction: "asc"
        }
    }, {
        imageTransform: true,
        imageScaleWidth: 64,
    })
    // const tags = menuItemTagPrismaEntity.findAll()
    // const sizeVariations = prismaClient.menuItemSize.findMany()

    // const data = Promise.all([categories, listGroupedByCategory, tags, sizeVariations]);
    const data = Promise.all([listGroupedByCategory]);

    return defer({ data });
}

export default function AdminGerenciamentoCardapioMainListLayout() {

    const {
        data,
    } = useLoaderData<typeof loader>();

    return (



        <Suspense fallback={
            <div className="flex justify-center items-center h-[150px]">
                <Loading color="black" />
            </div>
        }>
            <Await resolve={data}>
                {([listGroupedByCategory]) => {

                    return (
                        <div>hello</div>
                    )

                }}
            </Await>
        </Suspense>
    )
}