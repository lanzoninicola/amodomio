import { useOutletContext } from "@remix-run/react";
import { DailyOrderQuickStat, DailyOrderSingleOutletContext } from "./admin.daily-orders.$id";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { Separator } from "~/components/ui/separator";


export default function DailyOrderSingleReport() {
    const outletContext = useOutletContext<DailyOrderSingleOutletContext>()
    const dailyOrder = outletContext?.dailyOrder as DailyOrder | undefined

    const totAmountOrders = dailyOrder?.totalOrdersAmount || 0
    const totMoneyCash = dailyOrder?.moneyCash || 0
    const totAmountMotoboy = dailyOrder?.totalMotoboyAmount || 0
    const granTotal = (totAmountOrders + totMoneyCash) - totAmountMotoboy

    return (
        <div className="p-6 md:max-w-lg border rounded-lg">
            <DailyOrderQuickStat label={"Total Pedidos"} value={dailyOrder?.totalOrdersNumber || 0} decimalsAmount={0} classNameLabel="text-lg" classNameValue="text-lg" />
            <Separator className="my-4" />
            <div className="flex flex-col gap-2">
                <DailyOrderQuickStat label={"Total Valor Pedidos (+)"} value={totAmountOrders} classNameLabel="text-sm" classNameValue="text-sm" />
                <DailyOrderQuickStat label={"Total Denaro Caixa Iniçial (+)"} value={totMoneyCash} classNameLabel="text-sm" classNameValue="text-sm" />
                <DailyOrderQuickStat label={"Total Valor Motoboy (-)"} value={totAmountMotoboy} classNameLabel="text-sm" classNameValue="text-sm" />
            </div>
            <Separator className="my-4" />
            <DailyOrderQuickStat label={"Total do dia"} value={granTotal} classNameLabel="text-lg" classNameValue="text-lg" />

        </div>
    )
}