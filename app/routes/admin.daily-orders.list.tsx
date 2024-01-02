import { LoaderArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ request }: LoaderArgs) {
    const dailyOrders = await dailyOrderEntity.findAllLimit(10);

    return ok({
        dailyOrders: dailyOrders || []
    })
}

export default function AdminDailyOrdersList() {
    const loaderData = useLoaderData<typeof loader>()

    const dailyOrders: DailyOrder[] = loaderData.payload.dailyOrders as DailyOrder[]



    return (
        <Container clazzName="h-screen">

            <h2 className="font-bold text-lg">Lista dos pedidos</h2>
            <ul>
                {
                    dailyOrders.map((dailyOrder: DailyOrder) => (
                        <li key={dailyOrder.id}>{dailyOrder.date}</li>
                    ))
                }
            </ul>
        </Container >
    )
}