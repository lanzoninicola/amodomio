import { Form, useLoaderData, useOutletContext } from "@remix-run/react";
import { DailyOrderQuickStat, DailyOrderSingleOutletContext } from "./admin.daily-orders.$id";
import { DailyOrder, DailyOrderFinance } from "~/domain/daily-orders/daily-order.model.server";
import { Separator } from "~/components/ui/separator";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Input } from "~/components/ui/input";
import { useEffect, useState } from "react";
import { Textarea } from "~/components/ui/textarea";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import tryit from "~/utils/try-it";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { ok, serverError } from "~/utils/http-response.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
    if (!params?.id) {
        return redirect(`/admin/daily-orders`)
    }

    const dailyOrder = await dailyOrderEntity.findById(params?.id)

    return ok({
        dailyOrder,
    })

}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "daily-order-close") {

        console.log(values)

        const dailyOrderId = values.dailyOrderId as string

        const dailyOrder = await dailyOrderEntity.findById(dailyOrderId)

        if (!dailyOrder) {
            return serverError("Daily Order not found")
        }

        const nextDailyOrder = JSON.parse(JSON.stringify(dailyOrder))
        delete nextDailyOrder._client
        delete nextDailyOrder._collectionName
        delete nextDailyOrder.id

        nextDailyOrder.finance.cashRegisterAmount.final = Number(values.cashRegisterAmountFinal)

        nextDailyOrder.finance.totalDailyAmount = {
            initial: Number(values.totalDailyAmountInitial),
            adjusted: Number(values.totalDailyAmountAdjusted),
            final: Number(values.totalDailyAmountFinal),
            adjustmentReason: values.totalDailyAmountAdjustmentReason as string
        }

        const [err, data] = await tryit(dailyOrderEntity.update(dailyOrderId, nextDailyOrder))

        if (err) {
            return serverError(err)
        }

        return ok("Dia fechado com successo")


    }

    return null

}


export default function DailyOrderSingleReport() {

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData?.payload?.dailyOrder as DailyOrder

    const dailyOrderFinance = dailyOrder?.finance as DailyOrderFinance

    const cashRegisterAmountInitial = dailyOrderFinance?.cashRegisterAmount.initial || 0
    const [cashRegisterAmountFinal, setMoneyCashRegisterAmountFinal] = useState(dailyOrderFinance?.cashRegisterAmount.final || 0)

    const totalOrdersAmount = dailyOrderFinance?.totalOrdersAmount || 0
    const totalMotoboyAmount = dailyOrderFinance?.totalMotoboyAmount || 0

    const totalDailyAmountInitial = (cashRegisterAmountFinal + totalOrdersAmount) - totalMotoboyAmount
    const [totalDailyAmountFinal, setTotalDailyAmountFinal] = useState(dailyOrderFinance?.totalDailyAmount.final || 0)
    const [totalDailyAmountAdjusted, setTotalDailyAmountAdjusted] = useState(dailyOrderFinance?.totalDailyAmount.adjusted || 0)

    const [showReason, setShowReason] = useState(false)
    const [totalDailyAmountAdjustmentReason, setTotalDailyAmountAdjustmentReason] = useState(dailyOrderFinance?.totalDailyAmount.adjustmentReason || "")

    return (

        <Form method="post">
            <input type="hidden" name="dailyOrderId" value={dailyOrder?.id} />

            <div className="p-6 md:max-w-lg border rounded-lg">
                <DailyOrderQuickStat label={"Total Pedidos"} value={dailyOrder?.totalOrdersNumber || 0} decimalsAmount={0} classNameLabel="text-lg" classNameValue="text-lg" />
                <Separator className="my-4" />

                <div className="flex flex-col gap-2">
                    <h4 className="font-semibold">Movimentação</h4>
                    <div className="flex flex-col gap-2">
                        <DailyOrderQuickStat label={"Total Valor Pedidos (+)"} value={totalOrdersAmount} classNameLabel="text-sm" classNameValue="text-sm font-normal" />
                        <DailyOrderQuickStat label={"Total Valor Motoboy (-)"} value={totalMotoboyAmount} classNameLabel="text-sm" classNameValue="text-sm font-normal" />
                        <DailyOrderQuickStat label={"Total Movimentação"} value={totalOrdersAmount - totalMotoboyAmount} classNameLabel="text-sm font-semibold" classNameValue="text-sm" />
                    </div>
                </div>
                <Separator className="my-4" />

                {/* <!-- Cash Register Money --> */}

                <div className="flex flex-col gap-2">
                    <h4 className="font-semibold">Caixa</h4>
                    <div className="flex flex-col gap-2">
                        <DailyOrderQuickStat label={"Valor Iniçial"} value={cashRegisterAmountInitial} classNameLabel="text-sm" classNameValue="text-sm" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm leading-none tracking-tight">Valor Final</span>
                            <Input type="text" id="cashRegisterAmountFinal" name="cashRegisterAmountFinal"
                                placeholder="Inserir valor"
                                className="w-[120px] bg-white text-right text-sm tracking-wide"
                                value={cashRegisterAmountFinal}
                                onChange={(e) => {
                                    let value = Number(e.target.value)

                                    if (Number.isNaN(value)) {
                                        setMoneyCashRegisterAmountFinal(0)
                                        return
                                    }

                                    if (value < 0) return

                                    setMoneyCashRegisterAmountFinal(value)
                                }}
                            />

                        </div>
                    </div>
                </div>

                <Separator className="my-4" />

                {/* <!-- Total do dia --> */}

                <div className="flex flex-col gap-2">
                    <h4 className="font-semibold">Resumo do dia</h4>
                    <div className="flex flex-col gap-2">


                        <DailyOrderQuickStat label={"Total do dia (Movimentação + Caixa)"} value={totalDailyAmountInitial} classNameLabel="text-sm" classNameValue="text-sm" />
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm leading-none tracking-tight">{`Total do dia final (R$${totalDailyAmountInitial})`}</span>
                            <Input type="text" id="totalDailyAmountFinal" name="totalDailyAmountFinal"
                                placeholder="Inserir valor"
                                className="w-[120px] bg-white text-right text-md tracking-wide"
                                defaultValue={totalDailyAmountFinal}
                                onChange={(e) => {
                                    const value = Number(e.target.value)

                                    if (Number.isNaN(value)) {
                                        setTotalDailyAmountFinal(0)
                                        setTotalDailyAmountAdjusted(0)
                                        return
                                    }

                                    if (value < 0) return

                                    setTotalDailyAmountFinal(value)
                                    setTotalDailyAmountAdjusted(value - totalDailyAmountInitial)

                                    if (value !== totalDailyAmountInitial) {
                                        setShowReason(true),
                                            setTotalDailyAmountAdjustmentReason("")
                                    } else {
                                        setShowReason(false),
                                            setTotalDailyAmountAdjustmentReason("")
                                    }

                                }}
                            />
                            <input type="hidden" name="totalDailyAmountInitial" value={totalDailyAmountInitial} />
                            <input type="hidden" id="totalDailyAmountAdjusted" name="totalDailyAmountAdjusted" defaultValue={totalDailyAmountAdjusted} />
                        </div>
                        {
                            showReason && (
                                <div className="flex justify-between items-start fade-in-50">
                                    <span className="text-sm leading-none tracking-tight">Razão</span>
                                    <Textarea id="totalDailyAmountAdjustmentReason" name="totalDailyAmountAdjustmentReason"
                                        placeholder="Inserir razão para adjustar manualmente o total do dia final"
                                        className="w-[360px] bg-white text-right text-sm"
                                        value={totalDailyAmountAdjustmentReason}
                                        onChange={(e) => {
                                            setTotalDailyAmountAdjustmentReason(e.target.value)
                                        }}
                                    />
                                </div>
                            )
                        }
                    </div>
                </div>

                <div className="flex justify-end w-full mt-6">
                    <SubmitButton actionName="daily-order-close"
                        idleText="Fechar o dia"
                        loadingText="Fechando..."
                        disabled={totalDailyAmountFinal === 0}
                    />

                </div>


            </div>
        </Form>


    )
}

