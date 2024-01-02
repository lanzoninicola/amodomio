import { LoaderArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useOutletContext } from "@remix-run/react";
import { PlusCircleIcon } from "lucide-react";
import Container from "~/components/layout/container/container";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { now } from "~/lib/dayjs";
import { ok } from "~/utils/http-response.server";
import { AdminOutletContext } from "./admin";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";

export async function loader({ request }: LoaderArgs) {

    const records = await dailyOrderEntity.findAllLimit(10, { order: "desc" })

    return ok({
        records
    })

}

export default function AdminDailyOrdersIndex() {
    const adminOutletContext = useOutletContext<AdminOutletContext>()

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrders = loaderData.payload.records as DailyOrder[]

    return (
        <div className="mt-12">
            <div className="flex justify-between pb-6 px-6 border-b-2 border-b-slate-100 h-[80px]">
                <div className="flex flex-col">
                    <h1 className="font-bold text-xl">Pedidos giornalieri</h1>
                    <span className="font-sm">Data: {now()}</span>
                </div>
                <Link to="/admin/daily-orders/list" className="mr-4">
                    <span className="text-sm underline">Lista dos pedidos</span>
                </Link>
            </div>
            <div className="flex gap-6 h-screen">
                <aside id="default-sidebar" className="top-32 z-40 w-64
            transition-transform -translate-x-full sm:translate-x-0 border-r-2 border-r-slate-100" aria-label="Sidebar">
                    <div className="px-3 py-4 w-full">
                        <Link to={`/admin/daily-orders/new`}>
                            <Button className="flex gap-2 items-center w-full">
                                <span className="text-md font-semibold">Novo dia</span>
                                <PlusCircleIcon size={16} />
                            </Button>
                        </Link>
                    </div>
                    <div className="h-full px-3 py-4 overflow-y-auto ">

                        <ul className="space-y-2 font-medium">
                            <ScrollArea className="h-1/2">
                                {
                                    dailyOrders.map(dailyOrder => {
                                        return (
                                            <div key={dailyOrder.id} >
                                                <Link to={`/admin/daily-orders/${dailyOrder.id}/transactions`} className="block p-2 w-full hover:bg-slate-100 hover:rounded-lg" >
                                                    <span className="text-xs font-semibold">{dailyOrder.date}</span>
                                                </Link>
                                                <Separator />
                                            </div>
                                        )
                                    })
                                }


                            </ScrollArea>
                        </ul>
                    </div>
                    <div className="h-full px-3 py-4 overflow-y-auto ">
                        <ul className="space-y-2 font-medium">

                        </ul>
                    </div>2
                </aside>
                <div className="py-6 px-4 w-full">
                    <Outlet context={
                        { ...adminOutletContext }
                    } />
                </div>
            </div>
        </div>

    )
}
