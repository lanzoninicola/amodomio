import { Setting } from "@prisma/client";
import { LoaderArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import KanbanCol from "~/components/kanban-col/kanban-col";
import KanbanOrderCardLargeScreen, { DelaySeverity } from "~/components/kanban-order-card/kanban-order-card-large-screen";
import Clock from "~/components/primitives/clock/clock";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { mogoOrdersInboundEntity } from "~/domain/mogo-orders-inbound/mogo-orders-inbound.entity.server";
import mogoEntity from "~/domain/mogo/mogo.entity.server";
import { MogoOrderWithDiffTime } from "~/domain/mogo/types";
import OrdersDeliveryTimeLeftDialogSettings from "~/domain/order-delivery-time-left/components/order-delivery-time-left-dialog-settings/order-delivery-time-left-dialog-settings";
import { SettingOptionModel } from "~/domain/setting/setting.option.model.server";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import useFormResponse from "~/hooks/useFormResponse";
import { nowUTC } from "~/lib/dayjs";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { createDecreasingArray } from "~/utils/create-decrease-array";
import getSearchParam from "~/utils/get-search-param";
import { ok, serverError } from "~/utils/http-response.server";
import toLowerCase from "~/utils/to-lower-case";
import tryit from "~/utils/try-it";

export interface StockMassaResponse {
    initial: {
        massaFamilia: number
        massaMedia: number
    },
    final: {
        massaFamilia: number
        massaMedia: number
    }

}

export async function loader({ request }: LoaderArgs) {

    const filterSearchParams = getSearchParam({ request, paramName: "filter" })

    const [err, orders] = await tryit(mogoEntity.getOrdersOpenedWithDiffTime())

    if (err) {
        return serverError(err)
    }

    // track opened orders
    const trackOrdersPromise = orders.map(o => mogoOrdersInboundEntity.trackOrder(o))
    await Promise.all(trackOrdersPromise)

    // start: get settings
    const minDeliveryTimeSettings = await SettingOptionModel.factory(
        "minTime",
        "delivery-time-range"
    );
    const maxDeliveryTimeSettings = await SettingOptionModel.factory(
        "maxTime",
        "delivery-time-range"
    );

    const minPickUpTimeSettings = await SettingOptionModel.factory(
        "minTime",
        "pick-up-time-range"
    );
    const maxPickUpTimeSettings = await SettingOptionModel.factory(
        "maxTime",
        "pick-up-time-range"
    );


    const stockMassaFamiliaSetting = await SettingOptionModel.factory("massaFamilia", "stockMassa")
    const stockMassaMediaSetting = await SettingOptionModel.factory("massaMedia", "stockMassa")
    // end: get settings

    let ordersToRender = [...orders]

    if (filterSearchParams === "only-delivery") {
        ordersToRender = ordersToRender.filter(o => o.isDelivery === true)
    }

    if (filterSearchParams === "only-counter") {
        ordersToRender = ordersToRender.filter(o => o.isDelivery === false)
    }


    const [errCounterMassa, stockMassa] = await prismaIt(mogoOrdersInboundEntity.getUpdatedStockMassa())


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
        pickUpTimeSettings: {
            minTime: minPickUpTimeSettings?.value || 0,
            maxTime: maxPickUpTimeSettings?.value || 0,
        },
        stockMassaSettings: {
            massaFamilia: stockMassaFamiliaSetting?.value || 0,
            massaMedia: stockMassaMediaSetting?.value || 0,
        },
        stockMassa
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

    if (_action === "pick-up-time-settings-edit") {
        const context = 'pick-up-time-range'
        const minTime = String(Number(values.minTime || "0"))
        const maxTime = String(Number(values.maxTime || "0"))




        const [errMinTime, valueMinTime] = await prismaIt(settingPrismaEntity.updateOrCreate({
            context,
            name: "minTime",
            value: minTime,
            type: "number"
        }))



        const [errMaxTime, valueMaxTime] = await prismaIt(settingPrismaEntity.updateOrCreate({
            context,
            name: "maxTime",
            value: maxTime,
            type: "number"
        }))


        if (errMinTime || errMaxTime) {
            return serverError("Erro a salvar a configuracao")
        }

        return ok("Configuração atualizada com successo")

    }

    if (_action === "delivery-time-settings-edit") {
        const context = 'delivery-time-range'
        const minTime = String(Number(values.minTime || "0"))
        const maxTime = String(Number(values.maxTime || "0"))


        const [errMinTime, valueMinTime] = await prismaIt(settingPrismaEntity.updateOrCreate({
            context,
            name: "minTime",
            value: minTime,
            type: "number"
        }))

        const [errMaxTime, valueMaxTime] = await prismaIt(settingPrismaEntity.updateOrCreate({
            context,
            name: "maxTime",
            value: maxTime,
            type: "number"
        }))

        if (errMinTime || errMaxTime) {
            return serverError("Erro a salvar a configuracao")
        }

        return ok("Configuração atualizada com successo")

    }

    if (_action === "order-delivery-time-left-stockMassa-settings-change") {
        const context = values.context as string
        const stockAmountMassaFamilia = isNaN(Number(values.massaFamilia)) ? 0 : Number(values.massaFamilia)
        const stockAmountMassaMedia = isNaN(Number(values.massaMedia)) ? 0 : Number(values.massaMedia)

        const massaFamiliaSetting: Partial<Setting> = {
            context,
            name: "massaFamilia",
            type: "number",
            value: String(stockAmountMassaFamilia),
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const massaMediaSetting: Partial<Setting> = {
            context,
            name: "massaMedia",
            type: "number",
            value: String(stockAmountMassaMedia),
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const [err, value] = await prismaIt(settingPrismaEntity.updateOrCreateMany(
            [massaFamiliaSetting, massaMediaSetting]
        ))

        return null
    }

    if (_action === "order-delivery-time-left-archive-active-records") {

        const [err, _] = await prismaIt(mogoOrdersInboundEntity.archiveActiveRecords())

        if (err) {
            return serverError(err)
        }

        return ok("Registros arquivados")

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
        <div className="relative flex flex-col gap-4 px-6 pt-16 md:pt-0 min-h-screen">
            <Header />
            <div className="grid grid-cols-4 gap-x-0 h-full">
                {
                    arrayMinutes().map((step, index) => {

                        const { min, max, isFirstStep, isLastStep } = step

                        const ordersFiltered = orders.filter(order => {

                            const deliveryTimeLeftMinutes = order?.diffDeliveryDateTimeToNow.minutes

                            if (isFirstStep === true) {
                                return deliveryTimeLeftMinutes >= min
                            }

                            if (isLastStep === true) {
                                return deliveryTimeLeftMinutes <= max
                            }

                            return (deliveryTimeLeftMinutes <= max && deliveryTimeLeftMinutes >= min)
                        })

                        ordersDisplayed.push(...ordersFiltered)

                        return (
                            <KanbanCol
                                key={index}
                                severity={index + 1}
                                title={max === 0 ? "Para entregar" : `Menos ou igual a ${max}'`}
                                description={max === 0 ? "Para entregar" : `Previsão de entrega em ${max} minutos`}
                                itemsNumber={ordersFiltered.length}
                            >
                                {ordersFiltered.map((o) => {
                                    return (
                                        <KanbanOrderCardLargeScreen key={o.NumeroPedido} order={o} orderTimeSeverity={(index + 1) as DelaySeverity} />
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

    const ordersWithBatataAoForno = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => toLowerCase(s.Descricao) === toLowerCase("Bacon e Batata ao Forno"))))
    const ordersWithBatataFrita = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => toLowerCase(s.Descricao) === toLowerCase("Calabresa e Batata Frita"))))
    const ordersWithAbobrinha = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => (toLowerCase(s.Descricao) === toLowerCase("Delicata") || toLowerCase(s.Descricao) === toLowerCase("Delicatissima") || toLowerCase(s.Descricao) === toLowerCase("Ortolana") || toLowerCase(s.Descricao) === toLowerCase("Italia")))))
    const ordersWithBeringela = orders.filter(o => o.Itens.some(i => i.Sabores.some(s => toLowerCase(s.Descricao) === toLowerCase("Siciliana"))))

    const AlertCardContent = ({ order }: { order: MogoOrderWithDiffTime }) => {
        const orderTime = order.HoraPedido || "Não definido"

        const [orderHH, orderMin] = orderTime.split(":")

        return (
            <>
                <span className="font-semibold">{order.NumeroPedido}</span>
                <span className="font-semibold text-lg">{`${orderHH}:${orderMin}`}</span>
            </>
        )
    }

    const AlertCard = ({ title, payload }: { title: string, payload: MogoOrderWithDiffTime[] }) => {
        return (
            <div className="flex flex-col items-start gap-2 rounded-lg border px-4 py-2 text-left text-sm transition-all hover:bg-accent bg-orange-300">
                <h4 className="text-xl font-semibold tracking-tight">{`${title} (${payload.length})`}</h4>
                <div className="grid grid-cols-2 gap-x-6">
                    <span className="text-[10px]">Pedido numero</span>
                    <span className="text-[10px]">Hórario pedido</span>
                    {payload.map(o => <AlertCardContent key={o.Id} order={o} />)}
                </div>

            </div>
        )

    }

    return (
        <div className="fixed bottom-0 backdrop-blur-md">
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

    const buttonLabel = navigation.state !== "idle" ? "Atualizando..." : (
        lastRequestTime && (
            <div className="flex gap-2 items-center">
                <RefreshCw />
                <span>{dayjs(lastRequestTime).format("HH:mm")}</span>
            </div>

        )
    )

    return (
        <div className="grid grid-cols-12 w-full items-center">
            <Form method="post" className="col-span-4">
                <div className="flex gap-2 items-center">
                    <Button type="submit" className="text-2xl"
                        name="_action"
                        value="kanban-timing-refresh"
                        ref={refreshSubmitButton}
                    >
                        {buttonLabel}

                    </Button>
                    <Separator orientation="vertical" />

                </div>

            </Form>


            <div className="grid grid-cols-4 col-span-6">
                <div className="flex gap-4 items-center justify-center col-span-2">
                    <div className="flex flex-col">
                        <span>Último despacho as:</span>
                        {/* <span className="text-xs">totDispatchTime: {totDispatchTime}</span> */}
                    </div>
                    <Clock minutesToAdd={totDispatchTime} highContrast={true} />
                </div>
                <StockMassaStat />

            </div>



            <div className="flex gap-4 justify-end items-center col-span-2">
                {/* <h4 >Tempo maximo de entrega <span className="font-semibold text-lg">{maxDeliveryTimeSettings} minutos</span> </h4> */}
                <Clock />
                <OrdersDeliveryTimeLeftDialogSettings showLabel={false} />
            </div>
        </div>
    )
}

function StockMassaStat() {
    const loaderData = useLoaderData<typeof loader>()

    let stockMassa: StockMassaResponse = loaderData.payload?.stockMassa || null

    const Stat = ({ label, number }: { label: string, number: number }) => {
        return (
            <div className={
                cn(
                    "flex flex-col gap-0 justify-center py-1 px-4 rounded-md text-white text-center",
                    (number <= 0) && "bg-gray-400",
                    (number <= 2 && number > 0) && "bg-red-500",
                    (number > 2 && number <= 4) && "bg-orange-500",
                    number > 4 && "bg-brand-blue"
                )
            }>
                <span className="text-xs">{label}</span>
                <span className="text-3xl font-semibold">{number}</span>
            </div>
        )
    }

    return (
        <div className="flex gap-4">
            <Stat label={`Familia (${stockMassa?.initial.massaFamilia})`} number={stockMassa?.final.massaFamilia || 0} />
            <Stat label={`Media (${stockMassa?.initial.massaMedia})`} number={stockMassa?.final.massaMedia || 0} />
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



