import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Await, defer, Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { channel } from "diagnostics_channel";
import { List } from "lucide-react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import { menuItemPrismaEntity, MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import getSearchParam from "~/utils/get-search-param";
import { badRequest, serverError } from "~/utils/http-response.server";
import { lastUrlSegment, urlAt } from "~/utils/url";

export const meta: MetaFunction = ({ data }) => {
    const item: MenuItemWithAssociations = data?.payload?.item

    return [
        { title: item?.name || "Nome não encontrado" },
    ];
};


export async function loader({ request, params }: LoaderFunctionArgs) {


    const itemId = params.id


    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }

    const [err, item] = await prismaIt(menuItemPrismaEntity.findById(itemId));

    if (err) {
        return serverError(err);
    }

    if (!item) {
        return badRequest("Nenhum item encontrado");
    }

    const sellingChannnels = await prismaClient.menuItemSellingChannel.findMany();


    const returnedData = Promise.all([
        sellingChannnels,
    ]);

    return defer({
        returnedData
    })
}



export default function SingleMenuItemVendaPrice() {
    const { returnedData } = useLoaderData<typeof loader>();
    const { pathname } = useLocation()

    const activeTab = lastUrlSegment(pathname)


    return (
        <Suspense fallback={<Loading />}>
            <Await resolve={returnedData}>

                {/* @ts-ignore */}
                {([sellingChannels]) => {


                    return (
                        <div className="flex flex-col">
                            <ul className="grid grid-cols-3">
                                {
                                    sellingChannels && (
                                        sellingChannels.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex).map(sc => {
                                            return (
                                                <Link to={`${sc.key}`}
                                                    className="hover:bg-muted my-4"
                                                >
                                                    <div className={
                                                        cn(
                                                            "flex items-center gap-2 justify-center  py-1",
                                                            activeTab === "list" && "bg-muted font-semibold rounded-md "
                                                        )
                                                    }>
                                                        <List size={14} />
                                                        <span className="text-[14px] uppercase tracking-wider font-semibold">
                                                            {sc.name}
                                                        </span>
                                                    </div>
                                                </Link>
                                            )
                                        })
                                    )
                                }
                            </ul>
                            <Separator className="mb-8" />
                            <Outlet key={pathname} />
                        </div>
                    )
                }}
            </Await>
        </Suspense>
    )
}