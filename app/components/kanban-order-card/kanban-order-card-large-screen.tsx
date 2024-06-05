
import { Truck, PersonStanding, ChevronRight, ChevronRightIcon, ClockIcon } from "lucide-react"
import { useState } from "react"
import { MogoOrderWithDiffTime } from "~/domain/mogo/types"
import { cn } from "~/lib/utils"
import { Separator } from "../ui/separator"

export type DelaySeverity = 1 | 2 | 3 | 4 | 5

interface OrderCardProps {
    order: MogoOrderWithDiffTime,
    orderTimeSeverity: DelaySeverity,
    showDeliveryTimeExpectedLabel?: boolean,
}

export default function KanbanOrderCardLargeScreen({
    order,
    orderTimeSeverity,
    showDeliveryTimeExpectedLabel = true
}: OrderCardProps) {
    const number = order.NumeroPedido
    const orderTime = order.HoraPedido || "Não definido"

    const [orderHH, orderMin] = orderTime.split(":")

    const customerName = order.Cliente
    const deliveryTime = order.deliveryTimeExpected.timeString
    const delayStringOrderTime = order.diffOrderDateTimeToNow.timeString
    const delayStringDeliveryTime = order.diffDeliveryDateTimeToNow.timeString
    const delayOnDeliveryTime = order.diffDeliveryDateTimeToNow.minutes < 0
    const isDelivery = order.isDelivery

    const orderItems = order.Itens || []
    const pizzaItems = orderItems.filter(i => (i.IdProduto === 19 || i.IdProduto === 18))

    const severity = {
        1: "bg-slate-50",
        2: "bg-orange-100",
        3: "bg-orange-200",
        4: "bg-red-300",
        5: "bg-red-400"
    }


    const [tabShown, setTabShown] = useState("")

    return (

        <div className="flex gap-x-0 shadow-xl hover:cursor-pointer hover:bg-slate-50 rounded-lg" >

            <div className="flex gap-x-0 w-full m-0">
                <div className={
                    cn(
                        "w-2 h-full rounded-l-lg",
                        severity[orderTimeSeverity]
                    )
                }></div>

                <div className="flex flex-col py-2 w-full">

                    {/** Header */}
                    <div className="grid grid-cols-4 px-2 mb-4 gap-x-1">
                        <div className="flex flex-col gap-2 ">
                            <span className="text-[10px]">Pedido numero</span>
                            <span className="font-semibold text-2xl">{number || "Não definido"}</span>
                        </div>
                        <div className="flex flex-col gap-2 ">
                            <span className="text-[10px]">Hórario pedido</span>
                            <span className="font-semibold text-2xl">{`${orderHH}:${orderMin}`}</span>
                        </div>
                        <div className="flex flex-col gap-2 ">
                            <span className="text-[10px]">Produtos</span>
                            <ul className="grid grid-cols-4">
                                {pizzaItems.map((p, idx) =>
                                    <span key={idx}
                                        className="font-semibold text-xl w-max "
                                    >{p.IdProduto === 18 ? "M" : "G"}</span>
                                )}
                            </ul>
                        </div>

                        <div className="flex flex-col justify-center items-center bg-brand-blue py-1 text-white">
                            {/* <span className="text-sm font-semibold">{isDelivery === true ? "Entrega:" : "Retirada:"}</span> */}
                            {isDelivery === true ? <Truck size={24} /> : <PersonStanding size={24} />}
                            <span className="text-3xl font-semibold">{deliveryTime}</span>
                        </div>
                    </div>

                    <div className="flex justify-between gap-2 items-center px-2">
                        <span className="text-[10px] text-center">Programado em</span>
                        <span className="text-xl">{delayStringDeliveryTime}</span>
                    </div>






                    {/* {
                        tabShown === "customer" && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs">Cliente: {customerName || "Não definido"}</span>
                            </div>
                        )
                    }



                    {
                        tabShown === "delays" && (
                            <div>
                                <h2 className="text-xs mb-2 font-semibold">Desde a criação pedido:</h2>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs ">Atrasos de: </span>
                                    <span className="text-xs ">{delayStringOrderTime || "Não definido"}</span>
                                </div>
                            </div>
                        )
                    } */}

                    {/** TAbs */}

                    {/* <Separator className="my-0" />

                    <div className="flex justify-between w-full">
                        <span className={cn(
                            "text-xs font-semibold",
                            tabShown === "products" && "underline"
                        )} onClick={() => setTabShown("products")}>PRODUTOS</span>
                        <Separator orientation="vertical" className="m-0" />
                        <span className={cn(
                            "text-xs font-semibold",
                            tabShown === "customer" && "underline"
                        )} onClick={() => setTabShown("customer")}>CLIENTE</span>
                        <Separator orientation="vertical" className="m-0" />
                        <span className={cn(
                            "text-xs font-semibold",
                            tabShown === "delays" && "underline"
                        )} onClick={() => setTabShown("delays")}>TEMPO</span>

                    </div> */}

                </div>

            </div>

            {delayOnDeliveryTime === true && <div className="bg-violet-400 animate-pulse w-2 rounded-r-lg m-0"></div>}

        </div>
    )
}