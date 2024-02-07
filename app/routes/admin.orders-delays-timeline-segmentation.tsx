import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import dayjs from "dayjs";
import { ArrowBigDownDash, ArrowBigUpDash, HelpCircle, PersonStanding, Settings, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import KanbanCol from "~/components/kanban-col/kanban-col";
import KanbanOrderCard from "~/components/kanban-order-card/kanban-order-card";
import Clock from "~/components/primitives/clock/clock";
import SubmitButton from "~/components/primitives/submit-button/submit-button";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import mogoEntity from "~/domain/mogo/mogo.entity.server";
import { MogoOrderWithDiffTime } from "~/domain/mogo/types";
import { settingEntity } from "~/domain/setting/setting.entity.server";
import { Setting } from "~/domain/setting/setting.model.server";
import useFormResponse from "~/hooks/useFormResponse";
import { now, nowUTC } from "~/lib/dayjs";
import { cn } from "~/lib/utils";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request }: LoaderArgs) {

    const [err, orders] = await tryit(mogoEntity.getOrdersOpenedWithDiffTime())

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
        lastRequestTime: nowUTC(),
        int: {
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
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

        return ok({ orders, lastRequestTime: nowUTC() })

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

    // console.log({ orders, ordersDeliveryAmount, ordersCounterAmount, orderLess20Opened, orderLess40Minutes, orderLess60Minutes, orderLess90Minutes, orderMore90Minutes })

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
                            <span>Ultima atualização {dayjs(lastRequestTime).format("HH:mm")}</span>
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
                            <KanbanOrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={1} />
                        )
                    })}
                </KanbanCol >

                <KanbanCol
                    severity={2}
                    title="Mais de 20 minutos"
                    description="Pedidos abertos entre 21 e 40 minutos"
                    itemsNumber={orderLess40Minutes.length}
                >
                    {orderLess40Minutes.map(o => <KanbanOrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={2} />)}
                </KanbanCol >

                <KanbanCol
                    severity={3}
                    title="Mais de 40 minutos"
                    description="Pedidos abertos entre 41 e 60 minutos"
                    itemsNumber={orderLess60Minutes.length}
                >
                    {orderLess60Minutes.map(o => <KanbanOrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={3} />)}
                </KanbanCol >
                <KanbanCol
                    severity={4}
                    title="Mais de 60 minutos"
                    description="Pedidos abertos entre 61 e 90 minutos"
                    itemsNumber={orderLess90Minutes.length}
                >
                    {orderLess90Minutes.map(o => <KanbanOrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={4} />)}
                </KanbanCol >
                <KanbanCol
                    severity={5}
                    title="Mais de 90 minutos"
                    description="Pedidos abertos há mais de 90 minutos"
                    itemsNumber={orderMore90Minutes.length}
                >
                    {orderMore90Minutes.map(o => <KanbanOrderCard key={o.NumeroPedido} order={o} orderTimeSeverity={5} />)}
                </KanbanCol >
            </div>
        </div >
    )
}







interface OrdersTimelineSegmentationSettingsProps {
    showLabel?: boolean
}


export function OrdersTimelineSegmentationSettings({ showLabel = true }: OrdersTimelineSegmentationSettingsProps) {

    const loaderData = useLoaderData<typeof loader>()
    const deliveryTimeSettings = loaderData?.payload?.deliveryTimeSettings
    const counterTimeSettings = loaderData?.payload?.counterTimeSettings
    const locale = loaderData?.payload?.int.locale
    const timezone = loaderData?.payload?.int.timezone

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
                    <DialogDescription>
                        <div className="flex flex-col">
                            <span>Locale: {locale}</span>
                            <span>Timezone: {timezone}</span>
                        </div>

                    </DialogDescription>
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