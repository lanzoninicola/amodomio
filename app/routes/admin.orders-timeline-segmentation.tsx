import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import dayjs from "dayjs";
import { ChevronRightSquare, HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Clock from "~/components/primitives/clock/clock";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import mogoEntity from "~/domain/mogo/mogo.entity.server";
import { MogoOrderWithDiffTime } from "~/domain/mogo/types";
import { Order } from "~/domain/order/order.model.server";
import useFormResponse from "~/hooks/useFormResponse";
import { formatDateOnyTime, now } from "~/lib/dayjs";
import { cn } from "~/lib/utils";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request }: LoaderArgs) {

    const [err, orders] = await tryit(mogoEntity.getOrdersOpened())

    if (err) {
        return serverError(err)
    }

    return ok({ orders, lastRequestTime: now("HH:mm") })


}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "kanban-timing-refresh") {
        const [err, orders] = await tryit(mogoEntity.getOrdersOpened())

        if (err) {
            return serverError(err)
        }

        return ok({ orders, lastRequestTime: now("HH:mm") })

    }

    return null

}

interface FormResponseData {
    orders: MogoOrderWithDiffTime[]
    lastRequestTime: string
}

export default function OrdersTimelineSegmentation() {

    const loaderData = useLoaderData<typeof loader>()
    const status = loaderData?.status
    const message = loaderData?.message

    let orders: MogoOrderWithDiffTime[] = loaderData?.payload?.orders || []
    let lastRequestTime: string = loaderData?.payload?.lastRequestTime || null

    const orderLess20Opened = orders.filter(order => order?.diffOrderDateTimeToNow.minutes < 20 && order?.diffOrderDateTimeToNow.minutes >= 0)
    const orderLess40Minutes = orders.filter(order => order?.diffOrderDateTimeToNow.minutes < 40 && order?.diffOrderDateTimeToNow.minutes >= 20)
    const orderLess60Minutes = orders.filter(order => order?.diffOrderDateTimeToNow.minutes < 60 && order?.diffOrderDateTimeToNow.minutes >= 40)
    const orderLess90Minutes = orders.filter(order => order?.diffOrderDateTimeToNow.minutes < 90 && order?.diffOrderDateTimeToNow.minutes >= 60)
    const orderMore90Minutes = orders.filter(order => order?.diffOrderDateTimeToNow.minutes >= 91)

    // console.log({ orders, orderLess20Opened, orderLess40Minutes, orderLess60Minutes, orderLess90Minutes, orderMore90Minutes })

    if (status === 500) {
        return (
            <div className="font-semibold text-red-500 text-center mt-32">
                Erro: {message}
            </div>
        )
    }

    const navigation = useNavigation()

    const formResponse = useFormResponse()
    const formData = formResponse.data as unknown as FormResponseData

    if (Array.isArray(formData?.orders) === true) {
        orders = formData?.orders || []
    }

    if (formData?.lastRequestTime) {
        lastRequestTime = formData?.lastRequestTime
    }



    const refreshSubmitButton = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            // Simulate button click
            if (refreshSubmitButton.current) {
                refreshSubmitButton.current.click();
            }
        }, 300_000); // Trigger click every 60 seconds (5 minute)

        return () => clearInterval(interval); // Cleanup the interval on component unmount
    }, []);

    return (
        <div className="flex flex-col gap-4 px-6 pt-16 min-h-screen">
            <div className="flex justify-between items-center">
                <Form method="post">
                    <div className="flex gap-2 items-center">
                        <Button type="submit" className="text-2xl"
                            name="_action"
                            value="kanban-timing-refresh"
                            ref={refreshSubmitButton}
                        >
                            {navigation.state !== "idle" ? "Atualizando..." : "Atualizar"}

                        </Button>
                        <Separator orientation="vertical" />
                        {lastRequestTime && (
                            <span>Ultima atualização {lastRequestTime}</span>
                        )}
                    </div>

                </Form>
                <Clock />
            </div>
            <div className="grid grid-cols-5 gap-x-0 h-full">
                <KanbanCol
                    severity={1}
                    title="Menos de 20 minutos"
                    description="Pedidos abertos há menos de 20 minutos"
                >
                    {orderLess20Opened.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                orderTimeSeverity={1}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                delayStringOrderTime={o?.diffOrderDateTimeToNow.timeString}
                                delayStringDeliveryTime={o?.diffDeliveryDateTimeToNow.timeString}
                                delayOnDeliveryTime={o?.diffDeliveryDateTimeToNow.minutes > 0}
                            />
                        )
                    })}
                </KanbanCol >

                <KanbanCol
                    severity={2}
                    title="Mais de 20 || Menos de 40"
                    description="Pedidos abertos entre 21 e 40 minutos"
                >
                    {orderLess40Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                orderTimeSeverity={2}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                delayStringOrderTime={o?.diffOrderDateTimeToNow.timeString}
                                delayStringDeliveryTime={o?.diffDeliveryDateTimeToNow.timeString}
                                delayOnDeliveryTime={o?.diffDeliveryDateTimeToNow.minutes > 0}
                            />
                        )
                    })}
                </KanbanCol >

                <KanbanCol
                    severity={3}
                    title="Mais de 40 || Menos de 60"
                    description="Pedidos abertos entre 41 e 60 minutos"
                >
                    {orderLess60Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                orderTimeSeverity={3}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                delayStringOrderTime={o?.diffOrderDateTimeToNow.timeString}
                                delayStringDeliveryTime={o?.diffDeliveryDateTimeToNow.timeString}
                                delayOnDeliveryTime={o?.diffDeliveryDateTimeToNow.minutes > 0}
                            />
                        )
                    })}
                </KanbanCol >
                <KanbanCol
                    severity={4}
                    title="Mais de 60 || Menos de 90"
                    description="Pedidos abertos entre 61 e 90 minutos"
                >
                    {orderLess90Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                orderTimeSeverity={4}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                delayStringOrderTime={o?.diffOrderDateTimeToNow.timeString}
                                delayStringDeliveryTime={o?.diffDeliveryDateTimeToNow.timeString}
                                delayOnDeliveryTime={o?.diffDeliveryDateTimeToNow.minutes > 0}
                            />
                        )
                    })}
                </KanbanCol >
                <KanbanCol
                    severity={5}
                    title="Mais de 90 minutos"
                    description="Pedidos abertos há mais de 90 minutos"
                >
                    {orderMore90Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                orderTimeSeverity={5}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                delayStringOrderTime={o?.diffOrderDateTimeToNow.timeString}
                                delayStringDeliveryTime={o?.diffDeliveryDateTimeToNow.timeString}
                                delayOnDeliveryTime={o?.diffDeliveryDateTimeToNow.minutes > 0}
                            />
                        )
                    })}
                </KanbanCol >
            </div>
        </div >
    )
}

interface KanbanColProps {
    children: React.ReactNode
    title: string
    description: string
    className?: string
    severity: number
}

function KanbanCol({ children, title, description, className, severity = 1, ...props }: KanbanColProps) {

    const [showDescription, setShowDescription] = useState(false)

    const severityClass: Record<number, string> = {
        1: "bg-slate-50",
        2: "bg-orange-100",
        3: "bg-orange-200",
        4: "bg-red-300",
        5: "bg-red-400"
    }

    return (
        <div className={
            cn(
                `flex flex-col gap-4 p-2 rounded-sm`,
                className,
            )
        } {...props}>
            <div className={
                cn(
                    "flex flex-col gap-2 p-2 rounded-sm",
                    severityClass[severity],
                )
            }>
                <span className="font-semibold">{title}</span>
                <div className="flex gap-2 items-center">

                    <span className="text-xs underline cursor-pointer" onClick={() => setShowDescription(!showDescription)}>
                        {showDescription ? 'Esconder' : 'Ver mais'}
                    </span>
                    <HelpCircle size={16} />

                </div>
                {showDescription && <span>{description}</span>}
            </div>

            {children}

        </div>
    )
}


type DelaySeverity = 1 | 2 | 3 | 4 | 5

interface OrderCardProps {
    // delay time between the order date and now
    orderTimeSeverity: DelaySeverity,
    number: string | undefined
    time: string | undefined
    customerName: string | undefined
    deliveryTime: string
    delayStringOrderTime: string | null
    delayStringDeliveryTime: string | null
    delayOnDeliveryTime: boolean
}

function OrderCard({
    orderTimeSeverity = 1,
    number,
    time,
    customerName,
    deliveryTime,
    delayStringOrderTime,
    delayStringDeliveryTime,
    delayOnDeliveryTime = false
}: OrderCardProps) {

    const severity = {
        1: "bg-slate-50",
        2: "bg-orange-100",
        3: "bg-orange-200",
        4: "bg-red-300",
        5: "bg-red-400"
    }

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
                    <div className="flex flex-col">
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <ChevronRightSquare size={16} />
                                <span className="text-sm font-semibold">{number || "Não definido"}</span>
                            </div>
                            <span className="text-sm font-semibold">{time || "Não definido"}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold">Entrega programada</span>
                            <span className="text-sm font-semibold">{deliveryTime}</span>
                        </div>
                    </div>

                    <span className="text-xs">Cliente: {customerName || "Não definido"}</span>

                    <Separator className="my-0" />
                    <div>
                        <h2 className="text-xs mb-2 font-semibold">Atrasos respeito a:</h2>

                        <div className="flex justify-between items-center">
                            <span className="text-xs ">Hora pedido: </span>
                            <span className="text-xs ">{delayStringOrderTime || "Não definido"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs ">Hora entrega: </span>
                            <span className="text-xs ">{delayStringDeliveryTime || "Não definido"}</span>
                        </div>
                    </div>

                </div>

            </div>

            {delayOnDeliveryTime === true && <div className="bg-violet-400 animate-pulse w-2 rounded-r-lg m-0"></div>}

        </div>
    )
}
