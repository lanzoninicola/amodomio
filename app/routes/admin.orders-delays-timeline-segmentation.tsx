import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { ArrowBigDownDash, ArrowBigUpDash, HelpCircle, PersonStanding, Settings, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Clock from "~/components/primitives/clock/clock";
import SubmitButton from "~/components/primitives/submit-button/submit-button";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import mogoEntity from "~/domain/mogo/mogo.entity.server";
import { MogoOrderWithDiffTime } from "~/domain/mogo/types";
import { settingEntity } from "~/domain/setting/setting.entity.server";
import { Setting } from "~/domain/setting/setting.model.server";
import useFormResponse from "~/hooks/useFormResponse";
import { now } from "~/lib/dayjs";
import { cn } from "~/lib/utils";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request }: LoaderArgs) {

    const [err, orders] = await tryit(mogoEntity.getOrdersOpenedWithDiffTime())

    // console.log(orders)

    if (err) {
        return serverError(err)
    }

    const [errSettings, settings] = await tryit(settingEntity.findSettingsByContext("order-timeline-segmentation-delivery-time"))

    // console.log({ settings })

    if (errSettings) {
        return serverError(errSettings)
    }

    let minDeliveryTimeSettings: Setting | undefined
    let maxDeliveryTimeSettings: Setting | undefined
    let minCounterTimeSettings: Setting | undefined
    let maxCounterTimeSettings: Setting | undefined

    if (settings) {
        minDeliveryTimeSettings = settings.find((o: Setting) => o.name === "minTimeDeliveryMinutes")
        maxDeliveryTimeSettings = settings.find((o: Setting) => o.name === "maxTimeDeliveryMinutes")
        minCounterTimeSettings = settings.find((o: Setting) => o.name === "minTimeCounterMinutes")
        maxCounterTimeSettings = settings.find((o: Setting) => o.name === "maxTimeCounterMinutes")
    }

    return ok({
        orders,
        lastRequestTime: now("HH:mm"),
        deliveryTimeSettings: {
            minTime: minDeliveryTimeSettings?.value || 0,
            maxTime: maxDeliveryTimeSettings?.value || 0,
        },
        counterTimeSettings: {
            minTime: minCounterTimeSettings?.value || 0,
            maxTime: maxCounterTimeSettings?.value || 0,
        }
    })


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

    if (_action === "order-timeline-segmentation-settings-change") {

        // console.log(values)

        const context = values.context as string
        const minTime = String(Number(values.minTimeDeliveryMinutes || 0))
        const maxTime = String(Number(values.maxTimeDeliveryMinutes || 0))

        const minTimeCounter = String(Number(values.minTimeCounterMinutes || 0))
        const maxTimeCounter = String(Number(values.maxTimeCounterMinutes || 0))

        if (!context) {
            return serverError("O contexto não pode ser null")
        }

        const [errMinTime, valueMinTime] = await tryit(settingEntity.updateOrCreate({
            context,
            name: "minTimeDeliveryMinutes",
            value: minTime,
            type: "number"
        }))

        const [errMaxTime, valueMaxTime] = await tryit(settingEntity.updateOrCreate({
            context,
            name: "maxTimeDeliveryMinutes",
            value: maxTime,
            type: "number"
        }))

        const [errCounterMinTime, valueCounterMinTime] = await tryit(settingEntity.updateOrCreate({
            context,
            name: "minTimeCounterMinutes",
            value: minTimeCounter,
            type: "number"
        }))

        const [errCounterMaxTime, valueCounterMaxTime] = await tryit(settingEntity.updateOrCreate({
            context,
            name: "maxTimeCounterMinutes",
            value: maxTimeCounter,
            type: "number"
        }))

        if (errMinTime || errMaxTime || errCounterMaxTime || errCounterMinTime) {
            return serverError("Erro a salvar a configuracao")
        }

        return ok("Configuração atualizada com successo")

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

    let ordersDeliveryAmount = orders.filter(o => o.isDelivery === true).length
    let ordersCounterAmount = orders.filter(o => o.isDelivery === false).length

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
            <div className="grid grid-cols-3 w-full">
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
                <div className="flex justify-center gap-4">
                    <div className="flex gap-2 items-center shadow-sm border rounded-lg px-4 py-2">
                        <span className="text-sm font-semibold">Pedidos delivery:</span>
                        <span className="text-lg font-mono font-semibold">{ordersDeliveryAmount}</span>
                    </div>
                    <div className="flex gap-2 items-center shadow-sm border rounded-lg px-4 py-2">
                        <span className="text-sm font-semibold">Pedidos balcão:</span>
                        <span className="text-lg font-mono font-semibold">{ordersCounterAmount}</span>
                    </div>
                </div>
                <div className="flex gap-4 justify-end">
                    <Clock />
                    <OrdersTimelineSegmentationSettings showLabel={false} />
                </div>
            </div>
            <div className="grid grid-cols-5 gap-x-0 h-full">
                <KanbanCol
                    severity={1}
                    title="Menos de 20 minutos"
                    description="Pedidos abertos há menos de 20 minutos"
                    itemsNumber={orderLess20Opened.length}
                >
                    {orderLess20Opened.map(o => {
                        return (
                            <OrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={1} />
                        )
                    })}
                </KanbanCol >

                <KanbanCol
                    severity={2}
                    title="Mais de 20 minutos"
                    description="Pedidos abertos entre 21 e 40 minutos"
                    itemsNumber={orderLess40Minutes.length}
                >
                    {orderLess40Minutes.map(o => <OrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={2} />)}
                </KanbanCol >

                <KanbanCol
                    severity={3}
                    title="Mais de 40 minutos"
                    description="Pedidos abertos entre 41 e 60 minutos"
                    itemsNumber={orderLess60Minutes.length}
                >
                    {orderLess60Minutes.map(o => <OrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={3} />)}
                </KanbanCol >
                <KanbanCol
                    severity={4}
                    title="Mais de 60 minutos"
                    description="Pedidos abertos entre 61 e 90 minutos"
                    itemsNumber={orderLess90Minutes.length}
                >
                    {orderLess90Minutes.map(o => <OrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={4} />)}
                </KanbanCol >
                <KanbanCol
                    severity={5}
                    title="Mais de 90 minutos"
                    description="Pedidos abertos há mais de 90 minutos"
                    itemsNumber={orderMore90Minutes.length}
                >
                    {orderMore90Minutes.map(o => <OrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={5} />)}
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
    itemsNumber?: number
}

function KanbanCol({ children, title, description, className, severity = 1, itemsNumber, ...props }: KanbanColProps) {

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
                    "flex gap-2 items-center justify-between p-2 rounded-sm",
                    severityClass[severity],
                )
            }>
                <div className="flex flex-col gap-2">
                    <span className="font-semibold text-sm">{title}</span>
                    <div className="flex gap-2 items-center">

                        <span className="text-xs underline cursor-pointer" onClick={() => setShowDescription(!showDescription)}>
                            {showDescription ? 'Esconder' : 'Ver mais'}
                        </span>
                        <HelpCircle size={16} />

                    </div>
                    {showDescription && <span>{description}</span>}
                </div>
                <div className="grid place-items-center rounded-full border border-black w-8 h-8">
                    <span className="font-semibold text-sm">{itemsNumber}</span>
                </div>
            </div>

            {children}

        </div>
    )
}


type DelaySeverity = 1 | 2 | 3 | 4 | 5

interface OrderCardProps {
    order: MogoOrderWithDiffTime,
    orderTimeSeverity: DelaySeverity
}

function OrderCard({
    order,
    orderTimeSeverity
}: OrderCardProps) {
    const number = order.NumeroPedido
    const time = order.HoraPedido
    const customerName = order.Cliente
    const deliveryTime = order.deliveryTimeExpected.timeString
    const delayStringOrderTime = order.diffOrderDateTimeToNow.timeString
    const delayStringDeliveryTime = order.diffDeliveryDateTimeToNow.timeString
    const delayOnDeliveryTime = order.diffDeliveryDateTimeToNow.minutes > 0
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
                                {isDelivery === true ? <Truck /> : <PersonStanding />}
                                <span className="text-sm font-semibold">{number || "Não definido"}</span>
                            </div>
                            <span className="text-sm font-semibold">{time || "Não definido"}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold">{isDelivery === true ? "Hora entrega:" : "Hora retirada:"}</span>
                            <span className="text-sm font-semibold">{deliveryTime}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-xs">Cliente: {customerName || "Não definido"}</span>
                        <div>
                            <span className="flex gap-2 text-xs items-center">
                                Pizzas: {pizzaItems.map(p => {

                                    // pizza media
                                    if (p.IdProduto === 18) {
                                        return <span className="flex text-xs font-semibold items-center"><ArrowBigDownDash /> ({p.Quantidade})</span>
                                    }

                                    // pizza familia
                                    if (p.IdProduto === 19) {
                                        return <span className="flex text-xs font-semibold items-center"><ArrowBigUpDash /> ({p.Quantidade})</span>
                                    }


                                })}
                            </span>
                        </div>
                    </div>

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

interface OrdersTimelineSegmentationSettingsProps {
    showLabel?: boolean
}


export function OrdersTimelineSegmentationSettings({ showLabel = true }: OrdersTimelineSegmentationSettingsProps) {

    const loaderData = useLoaderData<typeof loader>()
    const deliveryTimeSettings = loaderData?.payload?.deliveryTimeSettings
    const counterTimeSettings = loaderData?.payload?.counterTimeSettings


    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost">
                    <Settings />
                    {showLabel && <span className="ml-2">Configuraçoes</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Configurações</DialogTitle>
                    {/* <DialogDescription>
                        Make changes to your profile here. Click save when you're done.
                    </DialogDescription> */}
                </DialogHeader>

                <Form method="post" className="flex flex-col gap-4 mt-2">
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold">Retiro no balcão (minutos)</h3>
                        <input type="hidden" name="context" value="order-timeline-segmentation-delivery-time" />
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-4 items-center justify-between">
                                <span>Tempo minimo</span>
                                <Input type="text" id="minTimeCounterMinutes" name="minTimeCounterMinutes" maxLength={2} className="w-[72px] bg-white"
                                    defaultValue={counterTimeSettings?.minTime || 0}
                                />
                            </div>
                            <div className="flex gap-4 items-center justify-between">
                                <span>Tempo maximo</span>
                                <Input type="text" id="maxTimeCounterMinutes" name="maxTimeCounterMinutes" maxLength={2} className="w-[72px] bg-white"
                                    defaultValue={counterTimeSettings?.maxTime || 0}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold">Tempo de entrega (minutos)</h3>
                        <input type="hidden" name="context" value="order-timeline-segmentation-delivery-time" />
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-4 items-center justify-between">
                                <span>Tempo minimo</span>
                                <Input type="text" id="minTimeDeliveryMinutes" name="minTimeDeliveryMinutes" maxLength={2} className="w-[72px] bg-white"
                                    defaultValue={deliveryTimeSettings?.minTime || 0}
                                />
                            </div>
                            <div className="flex gap-4 items-center justify-between">
                                <span>Tempo maximo</span>
                                <Input type="text" id="maxTimeDeliveryMinutes" name="maxTimeDeliveryMinutes" maxLength={2} className="w-[72px] bg-white"
                                    defaultValue={deliveryTimeSettings?.maxTime || 0}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <SubmitButton actionName="order-timeline-segmentation-settings-change" />
                    </div>
                </Form>
            </DialogContent>
        </Dialog>
    )
}