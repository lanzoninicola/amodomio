import { LoaderArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import dayjs from "dayjs";
import { loadBundle } from "firebase/firestore";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import KanbanCol from "~/components/kanban-col/kanban-col";
import KanbanOrderCardLargeScreen from "~/components/kanban-order-card/kanban-order-card-large-screen";
import Clock from "~/components/primitives/clock/clock";
import SubmitButton from "~/components/primitives/submit-button/submit-button";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import mogoEntity from "~/domain/mogo/mogo.entity.server";
import { MogoOrderWithDiffTime } from "~/domain/mogo/types";
import OrdersDeliveryTimeLeftDialogSettings from "~/domain/order-delivery-time-left/components/order-delivery-time-left-dialog-settings/order-delivery-time-left-dialog-settings";
import { settingEntity } from "~/domain/setting/setting.entity.server";
import { Setting } from "~/domain/setting/setting.model.server";
import useFormResponse from "~/hooks/useFormResponse";
import { nowUTC } from "~/lib/dayjs";
import { cn } from "~/lib/utils";
import { createDecreasingArray } from "~/utils/create-decrease-array";
import getSearchParam from "~/utils/get-search-param";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request }: LoaderArgs) {

    const filterSearchParams = getSearchParam({ request, paramName: "filter" })

    const [err, orders] = await tryit(mogoEntity.getOrdersOpenedWithDiffTime())

    if (err) {
        return serverError(err)
    }

    const [errSettings, settings] = await tryit(settingEntity.findSettingsByContext("order-timeline-segmentation-delivery-time"))


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

    let ordersToRender = [...orders]

    if (filterSearchParams === "only-delivery") {
        ordersToRender = ordersToRender.filter(o => o.isDelivery === true)
    }

    if (filterSearchParams === "only-counter") {
        ordersToRender = ordersToRender.filter(o => o.isDelivery === false)
    }

    return ok({
        orders: ordersToRender,
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


export default function OrdersDeliveryTimeLeft() {

    const loaderData = useLoaderData<typeof loader>()
    const status = loaderData?.status
    const message = loaderData?.message


    if (status >= 400) {
        return (
            <div className="font-semibold text-red-500 text-center mt-32">
                Erro: {message}
            </div>
        )
    }

    let orders: MogoOrderWithDiffTime[] = loaderData?.payload?.orders || []


    const arrayMinutes = useCallback(() => createDecreasingArray(90, 30), [])

    const ordersDisplayed: MogoOrderWithDiffTime[] = []


    return (
        <div className="flex flex-col gap-4 px-6 pt-16 md:pt-0 min-h-screen relative">
            <Header />
            <div className="grid grid-cols-4 gap-x-0 h-full">
                {
                    arrayMinutes().map((step, index) => {

                        const { min, max, isFirstStep } = step

                        const ordersFiltered = orders.filter(order => {

                            const deliveryTimeLeftMinutes = order?.diffDeliveryDateTimeToNow.minutes

                            if (isFirstStep === true) {
                                return deliveryTimeLeftMinutes >= min
                            }

                            return (deliveryTimeLeftMinutes <= max && deliveryTimeLeftMinutes >= min)
                        })

                        ordersDisplayed.push(...ordersFiltered)

                        return (
                            <KanbanCol
                                key={index}
                                severity={index + 1}
                                title={max === 0 ? "Da entregar" : `Menos o igual a ${max}'`}
                                description={max === 0 ? "Da entregar" : `Previsão de entrega em ${max} minutos`}
                                itemsNumber={ordersFiltered.length}
                            >
                                {ordersFiltered.map((o, index) => {
                                    return (
                                        <KanbanOrderCardLargeScreen key={o.NumeroPedido} order={o} orderTimeSeverity={5} />
                                    )
                                })}
                            </KanbanCol>
                        )
                    })
                }


            </div>
            <AlertsIngredients orders={ordersDisplayed} />
        </div >
    )
}

function AlertsIngredients({ orders }: { orders: MogoOrderWithDiffTime[] }) {

    const ordersWithBatataAoForno = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => s.Descricao === "Bacon e Batata ao Forno")))
    const ordersWithBatataFrita = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => s.Descricao === "Calabresa e Batata Frita")))
    const ordersWithAbobrinha = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => (s.Descricao === "Delicata" || s.Descricao === "Delicatissima" || s.Descricao === "Ortolana" || s.Descricao === "Italia"))))
    const ordersWithBeringela = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => s.Descricao === "Siciliana")))

    const AlertCardContent = ({ order }: { order: MogoOrderWithDiffTime }) => {
        const orderTime = order.HoraPedido || "Não definido"

        const [orderHH, orderMin] = orderTime.split(":")

        return (
            <>
                <span className="font-semibold text-lg">{order.NumeroPedido}</span>
                <span className="font-semibold text-lg">{`${orderHH}:${orderMin}`}</span>
            </>
        )
    }

    const AlertCard = ({ title, payload }: { title: string, payload: MogoOrderWithDiffTime[] }) => {
        return (
            <div className="flex flex-col items-start gap-2 rounded-lg border px-4 py-2 text-left text-sm transition-all hover:bg-accent bg-orange-300">
                <h4 className="text-2xl font-semibold tracking-tight">{`${title} (${payload.length})`}</h4>
                <div className="grid grid-cols-2 gap-x-6">
                    <span className="text-[10px]">Pedido numero</span>
                    <span className="text-[10px]">Hórario pedido</span>
                    {payload.map(o => <AlertCardContent key={o.Id} order={o} />)}
                </div>

            </div>
        )

    }

    return (
        <div className="absolute bottom-[70px] left-0 right-0 backdrop-blur-md">
            <div className="w-full h-full px-8 py-4 flex gap-4">
                {ordersWithBatataAoForno.length > 0 && <AlertCard title="Batatas ao Forno" payload={ordersWithBatataAoForno} />}

                {ordersWithBatataFrita.length > 0 && <AlertCard title="Batatas Frita" payload={ordersWithBatataFrita} />}

                {ordersWithAbobrinha.length > 0 && <AlertCard title="Abobrinha ao Forno" payload={ordersWithAbobrinha} />}

                {ordersWithBeringela.length > 0 && <AlertCard title="Beringela ao Forno" payload={ordersWithBeringela} />}

            </div>

        </div>
    )
}


function Header() {
    const loaderData = useLoaderData<typeof loader>()

    let orders: MogoOrderWithDiffTime[] = loaderData?.payload?.orders || []
    let lastRequestTime: string = loaderData?.payload?.lastRequestTime || null
    const maxDeliveryTimeSettings = loaderData?.payload?.deliveryTimeSettings?.maxTime

    const navigation = useNavigation()

    const formResponse = useFormResponse()
    const formData = formResponse.data as unknown as FormResponseData
    if (Array.isArray(formData?.orders) === true) {
        orders = formData?.orders || []
    }

    if (formData?.lastRequestTime) {
        lastRequestTime = formData?.lastRequestTime
    }

    /** start - refresh mechanism */
    const refreshSubmitButton = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        const interval = setInterval(() => {
            // Simulate button click
            if (refreshSubmitButton.current) {
                refreshSubmitButton.current.click();
            }
        }, 180_000); // Trigger click every 60 seconds (3 minutes)

        return () => clearInterval(interval); // Cleanup the interval on component unmount
    }, []);
    /** end - refresh mechanism */

    const totDispatchTime = orders.map(o => o.totDispatchTimeInMinutes).reduce((a, b) => a + b, 0)

    return (
        <div className="grid grid-cols-3 w-full items-center">
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
            <div className="flex gap-4 items-center justify-center">
                <div className="flex flex-col">
                    <span>Hora do último despacho:</span>
                    <span className="text-xs">totDispatchTime: {totDispatchTime}</span>
                </div>
                <Clock minutesToAdd={totDispatchTime} highContrast={true} />
            </div>



            <div className="flex gap-4 justify-end items-center">
                {/* <h4 >Tempo maximo de entrega <span className="font-semibold text-lg">{maxDeliveryTimeSettings} minutos</span> </h4> */}
                <Clock />
                <OrdersDeliveryTimeLeftDialogSettings showLabel={false} />
            </div>
        </div>
    )
}



function Filters() {
    const loaderData = useLoaderData<typeof loader>()

    let orders: MogoOrderWithDiffTime[] = loaderData?.payload?.orders || []
    let ordersDeliveryAmount = orders.filter(o => o.isDelivery === true).length
    let ordersCounterAmount = orders.filter(o => o.isDelivery === false).length

    const [searchParams, setSearchParams] = useSearchParams()

    return (

        <div className="flex justify-center gap-4">
            <Link to="?filter=all">
                <div className={
                    cn(
                        "flex gap-2 items-center shadow-sm border rounded-lg px-4 py-1",
                        searchParams.get("filter") === "all" && "border-black"
                    )
                }>
                    <span className="text-sm">Todos:</span>
                    <span className="text-lg font-mono font-semibold">{orders.length || 0}</span>
                </div>
            </Link>
            <Link to="?filter=only-delivery">
                <div className={
                    cn(
                        "flex gap-2 items-center shadow-sm border rounded-lg px-4 py-1",
                        searchParams.get("filter") === "only-delivery" && "border-black"
                    )
                }>
                    <span className="text-sm">Delivery:</span>
                    <span className="text-lg font-mono font-semibold">{ordersDeliveryAmount}</span>
                </div>
            </Link>
            <Link to="?filter=only-counter">
                <div className={
                    cn(
                        "flex gap-2 items-center shadow-sm border rounded-lg px-4 py-1",
                        searchParams.get("filter") === "only-counter" && "border-black"
                    )
                }>
                    <span className="text-sm">Balcão:</span>
                    <span className="text-lg font-mono font-semibold">{ordersCounterAmount}</span>
                </div>
            </Link>
        </div>

    )
}



