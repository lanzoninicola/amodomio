
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

export default function KanbanOrderCardMediumScreen({
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

                <div className="flex flex-col gap-4 px-4 py-2 w-full">

                    {/** Header */}

                    <div className="flex flex-col gap-3" onClick={() => setTabShown("")}>
                        <div className="grid grid-cols-2 w-full gap-4 ">
                            <div className="flex flex-col text-xs font-semibold">
                                <div className="flex gap-1 items-center">
                                    <ChevronRightIcon size={14} />
                                    <span>{number || "Não definido"}</span>
                                </div>
                                <div className="flex gap-1 items-center">
                                    <ClockIcon size={14} />
                                    <span>{`${orderHH}:${orderMin}`}</span>
                                </div>
                            </div>

                            <div className="flex justify-end items-center ">
                                <div className="flex gap-2 items-center bg-brand-blue rounded-lg py-1 px-2 text-white w-max">
                                    {/* <span className="text-sm font-semibold">{isDelivery === true ? "Entrega:" : "Retirada:"}</span> */}
                                    {isDelivery === true ? <Truck size={15} /> : <PersonStanding size={14} />}
                                    <span className="text-sm font-semibold">{deliveryTime}</span>
                                </div>
                            </div>
                        </div>
                        {
                            showDeliveryTimeExpectedLabel === true && (
                                <div className="flex justify-between text-xs">
                                    <span>Entrega programada em</span>
                                    <span className="font-semibold">{delayStringDeliveryTime}</span>
                                </div>
                            )
                        }
                    </div>

                    {/** Products */}
                    {
                        tabShown === "products" && (
                            <div className="flex gap-2 items-center">
                                <span className="text-xs">Pizzas:</span>
                                <ul className="flex gap-2 text-sm items-center">
                                    {pizzaItems.map((p, idx) => {

                                        return (
                                            <li key={idx} className="flex gap-1 font-semibold">
                                                <span>{p.IdProduto === 18 ? "Medía" : "Familía"}</span>
                                                <span>({p.Quantidade})</span>
                                                {/* <ul>
                                                {
                                                    p.Sabores.map((s, idx) => {
                                                        return (
                                                            <li key={idx}>{s.Descricao}</li>
                                                        )
                                                    }
                                                    )
                                                }
                                            </ul> */}
                                            </li>
                                        )

                                        // return (
                                        //     <span key={idx} className="flex text-xs font-semibold items-center">
                                        //         {p.IdProduto === 18 ? <ArrowBigDownDash /> : <ArrowBigUpDash />} ({p.Quantidade})
                                        //     </span>
                                        // )
                                    })}
                                </ul>
                            </div>
                        )
                    }


                    {
                        tabShown === "customer" && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs">Cliente: {customerName || "Não definido"}</span>
                            </div>
                        )
                    }

                    {/** Atrasos */}

                    {
                        tabShown === "delays" && (
                            <div>
                                <h2 className="text-xs mb-2 font-semibold">Desde a criação pedido:</h2>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs ">Tempo decorrido: </span>
                                    <span className="text-xs ">{delayStringOrderTime || "Não definido"}</span>
                                </div>
                            </div>
                        )
                    }

                    {/** TAbs */}

                    <Separator className="my-0" />

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

                    </div>

                </div>

            </div>

            {delayOnDeliveryTime === true && <div className="bg-violet-400 animate-pulse w-2 rounded-r-lg m-0"></div>}

        </div>
    )
}