import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData } from "@remix-run/react";
import { PlusCircle, PlusCircleIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { now, nowMergedString } from "~/lib/dayjs";
import { ok } from "~/utils/http-response.server";

type DailyOrderFormAction = "daily-orders-create" | "daily-orders-update"

export async function loader({ request }: LoaderArgs) {

    const records = await dailyOrderEntity.findAllLimit(10)

    return ok({
        records
    })

}




export default function AdminDailyOrdersIndex() {

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrders = loaderData.payload.records as DailyOrder[]

    console.log(dailyOrders)

    return (
        <Container clazzName="h-screen">
            <div className="flex flex-col item-center gap-8">
                <div className="flex flex-col item-center mt-12">
                    <div className="flex justify-between mb-12">
                        <div className="flex flex-col">
                            <h1 className="font-bold text-xl">Pedidos giornalieri</h1>
                            <span className="font-sm">Data: {now()}</span>
                        </div>
                        <Link to="/admin/daily-orders/list" className="mr-4">
                            <span className="text-sm underline">Lista dos pedidos</span>
                        </Link>
                    </div>
                </div>
            </div>
            <div className="w-full overflow-h-hidden">
                <ul className="flex gap-1">
                    <Link to={`/admin/daily-orders/new`}>
                        <MiniTab>
                            <div className="flex gap-2 items-center">
                                <span className="text-md font-semibold">Novo dia</span>
                                <PlusCircleIcon size={16} />
                            </div>
                        </MiniTab>
                    </Link>
                    {
                        dailyOrders.map(dailyOrder => {
                            return (
                                <Link key={dailyOrder.id} to={`/admin/daily-orders/${dailyOrder.id}`}>
                                    <MiniTab>
                                        <span className="text-sm font-semibold">{dailyOrder.date}</span>
                                    </MiniTab>
                                </Link>
                            )
                        })
                    }
                </ul>
                <div className="py-6">
                    <Outlet />
                </div>
            </div>
        </Container>
    )
}

interface MiniTabProps {
    children: React.ReactNode
}


function MiniTab({ children }: MiniTabProps) {

    return (
        <li className="bg-slate-200 rounded-tl-xl rounded-tr-xl px-4 py-1">
            {children}
        </li>
    )
}