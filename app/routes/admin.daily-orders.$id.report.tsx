import { useOutletContext } from "@remix-run/react";
import { DailyOrderQuickStat, DailyOrderSingleOutletContext } from "./admin.daily-orders.$id";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";


export default function DailyOrderSingleReport() {
    const outletContext = useOutletContext<DailyOrderSingleOutletContext>()
    const dailyOrder = outletContext?.dailyOrder as DailyOrder | undefined

    return (
        <div className="p-6 md:max-w-lg border rounded-lg">
            <div className="flex flex-col gap-4">
                <DailyOrderQuickStat label={"Total Pedidos"} value={dailyOrder?.totalOrdersNumber || 0} decimalsAmount={0} />
                <DailyOrderQuickStat label={"Total Valor Pedidos"} value={dailyOrder?.totalOrdersAmount || 0} />
                <DailyOrderQuickStat label={"Total Valor Motoboy"} value={dailyOrder?.totalMotoboyAmount || 0} />
            </div>
        </div>
    )
}