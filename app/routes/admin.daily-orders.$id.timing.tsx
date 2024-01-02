import { Separator } from "@radix-ui/react-select";
import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { ChevronRightSquare, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import mogoEntity from "~/domain/mogo/mogo.entity.server";
import { MogoOrderWithDiffTime } from "~/domain/mogo/types";
import useFormResponse from "~/hooks/useFormResponse";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request }: LoaderArgs) {

    const [err, orders] = await tryit(mogoEntity.getOrdersOpened())

    if (err) {
        return serverError(err)
    }

    return ok({ orders })


}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "kanban-timing-refresh") {
        const [err, orders] = await tryit(mogoEntity.getOrdersOpened())

        if (err) {
            return serverError(err)
        }

        return ok({ orders })

    }

    return null

}

interface FormResponseData {
    orders: MogoOrderWithDiffTime[]
}

export default function DailyOrderSingleTiming() {

    const loaderData = useLoaderData<typeof loader>()
    const status = loaderData?.status
    const message = loaderData?.message

    let orders: MogoOrderWithDiffTime[] = loaderData?.payload?.orders || []

    const orderLess20Opened = orders.filter(order => order?.diffMinutesToNow < 20 && order?.diffMinutesToNow >= 0)
    const orderLess40Minutes = orders.filter(order => order?.diffMinutesToNow < 40 && order?.diffMinutesToNow >= 20)
    const orderLess60Minutes = orders.filter(order => order?.diffMinutesToNow < 60 && order?.diffMinutesToNow >= 40)
    const orderLess90Minutes = orders.filter(order => order?.diffMinutesToNow < 90 && order?.diffMinutesToNow >= 60)
    const orderMore90Minutes = orders.filter(order => order?.diffMinutesToNow >= 91)


    if (status === 500) {
        return (
            <div className="font-semibold text-red-500 text-center">{message}</div>
        )
    }

    const navigation = useNavigation()

    const formResponse = useFormResponse()
    const formData = formResponse.data as unknown as FormResponseData

    if (Array.isArray(formData?.orders) === true) {
        orders = formData?.orders || []
    }

    return (
        <div className="flex flex-col gap-4">
            <Form method="post">
                <Button type="submit" className="font-semibold"
                    name="_action"
                    value="kanban-timing-refresh">
                    {navigation.state !== "idle" ? "Atualizando..." : "Atualizar"}

                </Button>

            </Form>
            <div className="grid grid-cols-5 gap-x-2">
                <KanbanCol
                    title="<= 20 minutos"
                    description="Pedidos abertos há menos de 20 minutos"
                    clazzName="bg-slate-50"
                >
                    {orderLess20Opened.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                diff={o?.diffMinutesToNow}
                            />
                        )
                    })}
                </KanbanCol >
                <KanbanCol
                    title="<= 40 minutos"
                    description="Pedidos abertos entre 21 e 40 minutos"
                    clazzName="bg-orange-100"
                >
                    {orderLess40Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                diff={o?.diffMinutesToNow}
                            />
                        )
                    })}
                </KanbanCol >

                <KanbanCol
                    title="<= 60 minutos"
                    description="Pedidos abertos entre 41 e 60 minutos"
                    clazzName="bg-orange-200"
                >
                    {orderLess60Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                diff={o?.diffMinutesToNow}
                            />
                        )
                    })}
                </KanbanCol >
                <KanbanCol
                    title="<= 90 minutos"
                    description="Pedidos abertos entre 61 e 90 minutos"
                    clazzName="bg-red-300"
                >
                    {orderLess90Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                diff={o?.diffMinutesToNow}
                            />
                        )
                    })}
                </KanbanCol >
                <KanbanCol
                    title="Mais de 90 minutos"
                    description="Pedidos abertos há mais de 90 minutos"
                    clazzName="bg-red-400"
                >
                    {orderMore90Minutes.map(o => {
                        return (
                            <OrderCard
                                key={o.NumeroPedido}
                                number={o?.NumeroPedido}
                                time={o?.HoraPedido}
                                customerName={o?.Cliente}
                                deliveryTime={o?.HoraEntregaTxt}
                                diff={o?.diffMinutesToNow}
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
    clazzName: string
}

function KanbanCol({ children, title, description, clazzName, ...props }: KanbanColProps) {

    const [showDescription, setShowDescription] = useState(false)

    return (
        <div className={`flex flex-col gap-4 p-4 rounded-sm ${clazzName}`} {...props}>
            <div className="flex flex-col gap-2">
                <span className="font-semibold">{title}</span>
                <div className="flex gap-2 items-center">

                    <span className="text-xs underline cursor-pointer" onClick={() => setShowDescription(!showDescription)}>
                        {showDescription ? 'Esconder' : 'Ver mais'}
                    </span>
                    <HelpCircle size={16} />

                </div>
                {showDescription && <span>{description}</span>}
            </div>
            <Separator />
            {children}
        </div>
    )
}


interface OrderCardProps {
    number: string | undefined
    time: string | undefined
    customerName: string | undefined
    deliveryTime: string
    diff: number
}

function OrderCard({ number, time, customerName, deliveryTime, diff }: OrderCardProps) {
    return (

        <div className="flex flex-col gap-4 rounded-lg shadow-lg p-4 hover:cursor-pointer hover:bg-slate-50 ">
            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                        <ChevronRightSquare size={16} />
                        <span className="text-sm font-semibold">{number || "Não definido"}</span>
                    </div>
                    <span className="text-sm font-semibold">{time || "Não definido"}</span>
                </div>
                <span className="text-sm font-semibold">Hora de entrega: {deliveryTime}</span>
            </div>
            <span className="text-xs mb-2">Nome cliente: {customerName || "Não definido"}</span>
            <span className="text-xs "> Minutos: {diff}</span>

        </div>
    )
}

