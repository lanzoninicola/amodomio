import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData } from "@remix-run/react";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DOTInboundChannel, DOTOperator, DOTPaymentMethod, DOTPizzaSize, DOTProduct, DailyOrder, DailyOrderTransaction } from "~/domain/daily-orders/daily-order.model.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import { Separator } from "~/components/ui/separator";
import dotOperators from "~/domain/daily-orders/dot-operators";
import useFormResponse from "~/hooks/useFormResponse";
import { AlertError } from "~/components/layout/alerts/alerts";
import { useEffect, useState } from "react";
import randomReactKey from "~/utils/random-react-key";
import getSearchParam from "~/utils/get-search-param";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { Loader } from "lucide-react";
import TransactionForm from "~/domain/daily-orders/components/transaction-form";


export async function loader({ request, params }: LoaderArgs) {
    if (!params?.id) {
        return redirect(`/admin/daily-orders`)
    }

    const dailyOrder = await dailyOrderEntity.findById(params?.id)

    return ok({
        dailyOrder,
        currentOperatorId: getSearchParam({ request, paramName: 'op' }),
    })

}


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const operator = dotOperators(values.operatorId as string) as DOTOperator

    if (values.dailyOrderId === undefined || values.dailyOrderId === "") {
        return serverError("O ID dos pedidos do dia não pode ser null")
    }

    if (_action === "daily-orders-pizzas-number-update") {

        if (Number.isNaN(values.number)) {
            return serverError("O numero de pizza está incorreto")
        }

        const [err, itemUpdated] = await tryit(
            dailyOrderEntity.updatePizzaSizeRestNumber(
                values.dailyOrderId as string,
                values.pizzaSize as DOTPizzaSize,
                Number(values.number)
            )
        )

        if (err) {
            return serverError(err)
        }

        return ok({
            action: "daily-orders-pizzas-number-update",
        })

    }


    return null


}


export interface DailyOrderSingleOutletContext {
    dailyOrder: DailyOrder
    operatorId: DOTOperator["id"] | null
}

export default function DailyOrdersSingle() {
    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData?.payload?.dailyOrder as DailyOrder
    const currentOperatorId = loaderData?.payload?.currentOperatorId

    const formResponse = useFormResponse()

    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-x-6">
                <PizzaSizeStat label={"Pizza Familía"} initialNumber={dailyOrder?.initialLargePizzaNumber} restNumber={dailyOrder.restLargePizzaNumber} />
                <PizzaSizeStat label={"Pizza Medía"} initialNumber={dailyOrder?.initialMediumPizzaNumber} restNumber={dailyOrder.restMediumPizzaNumber} />
            </div>
            <Separator className="my-6" />

            {/*
            <div className="flex gap-4 items-center w-full justify-center">
                <DailyOrderQuickStat label={"Total Pedidos"} value={dailyOrder?.totalOrdersNumber || 0} decimalsAmount={0} />
                <DailyOrderQuickStat label={"Total Valor Pedidos"} value={dailyOrder?.totalOrdersAmount || 0} />
                <DailyOrderQuickStat label={"Total Valor Motoboy"} value={dailyOrder?.totalMotoboyAmount || 0} />
            </div>
            <Separator className="my-6" />
            */}
            <div className="flex flex-col gap-4 w-full">
                <div className="bg-slate-50 rounded-xl p-4">
                    <Form method="post" className="flex items-center gap-2 w-full" ref={formResponse.formRef}>
                        <TransactionForm
                            dailyOrderId={dailyOrder.id}
                            saveActionName="daily-orders-transaction-create"
                            operatorId={currentOperatorId}
                        />
                    </Form>
                    {
                        formResponse?.isError && (
                            <div className="md:max-w-md mt-6">
                                <AlertError message={formResponse.errorMessage} title="Erro!" position="top" />
                            </div>

                        )
                    }
                </div>

                <ul className="flex gap-2">
                    <li className="border-l-2 border-t-2 border-r-2 rounded-tl-lg rounded-tr-lg px-4 py-2">
                        <Link to="transactions">
                            <span className="font-semibold">Pedidos do dia</span>
                        </Link>
                    </li>

                    <li className="border-l-2 border-t-2 border-r-2 rounded-tl-lg rounded-tr-lg px-4 py-2">
                        <Link to="report">
                            <span className="font-semibold">Relatorio do dia</span>
                        </Link>
                    </li>
                    <li className="border-l-2 border-t-2 border-r-2 rounded-tl-lg rounded-tr-lg px-4 py-2">
                        <Link to="report-motoboy">
                            <span className="font-semibold">Relatorio Motoboy</span>
                        </Link>
                    </li>
                </ul>
                <Outlet context={{
                    dailyOrder,
                    operatorId: currentOperatorId
                }} />

            </div>
        </div >

    )
}

interface PizzaSizeStatProps {
    label: string
    initialNumber?: number
    restNumber?: number
}

function PizzaSizeStat({ label, initialNumber = 0, restNumber = 0 }: PizzaSizeStatProps) {

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData?.payload?.dailyOrder as DailyOrder
    const [restNumberInput, setRestNumberInput] = useState(restNumber)
    const [isRestNumberChanged, setIsRestNumberChanged] = useState(false)

    const warn = restNumber > 1 && restNumber <= 3
    const error = restNumber <= 1

    const formResponse = useFormResponse()

    const formSubmissionState = useFormSubmissionnState()
    let formSubmissionInProgress = formSubmissionState === "submitting"
    let saveLabel = formSubmissionInProgress ? ("Salvando...") : ("Salvar alterações")

    function handleChangeNumber(newValue: string) {
        if (Number.isNaN(Number(newValue))) {
            setRestNumberInput(0)
            return
        }
        setRestNumberInput(Number(newValue))
    }

    useEffect(() => {
        if (formResponse.isError) {
            setIsRestNumberChanged(false)
            setRestNumberInput(restNumber)
        }

    }, [formResponse.isError])

    return (
        <div className="flex flex-col gap-2">
            <div key={randomReactKey()} className={`flex justify-between items-end gap-12 border rounded-lg py-4 px-6
        ${warn === true ? 'bg-orange-500' : error === true ? 'bg-red-500' : ""}`}>
                <h4 className={`text-3xl leading-none tracking-tight ${warn === true || error === true ? 'text-white' : 'text-black'}`}>{label}</h4>
                <Form method="post" className={`flex gap-4 ${warn === true || error === true ? 'text-white' : 'text-black'}`} ref={formResponse.formRef}>
                    <div className="grid grid-cols-2">
                        <div className="flex gap-4">
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs leading-none tracking-tight">Iniciais</span>
                                    <input type="text" defaultValue={initialNumber}
                                        className="text-xl  border-none font-semibold leading-none tracking-tight w-[72px] text-center pt-2 bg-transparent outline-none"
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-xs leading-none tracking-tight">Restante</span>
                                    <input type="text"
                                        name="number"
                                        className="text-xl  border-none font-semibold leading-none tracking-tight w-[72px] text-center pt-2 bg-transparent outline-none"
                                        onChange={e => {
                                            const newValue = e.target.value

                                            if (Number(newValue) !== restNumber) {
                                                setIsRestNumberChanged(true)
                                            }
                                            handleChangeNumber(newValue)
                                        }}
                                        value={restNumberInput || 0}

                                    />

                                </div>
                            </div>


                        </div>
                        <input type="hidden" name="dailyOrderId" value={dailyOrder.id} />
                        <input type="hidden" name="pizzaSize" value={label} />
                        {isRestNumberChanged === true &&
                            <div className="flex gap-2 items-center justify-end">
                                {formSubmissionInProgress && <Loader className="text-md" />}
                                <button type="submit" className="text-sm underline justify-self-end" name="_action" value={"daily-orders-pizzas-number-update"}>
                                    {saveLabel}

                                </button>
                            </div>
                        }
                    </div>
                </Form>
            </div>
            {/* {
                formResponse.isOk === true &&
                formResponse.data?.action === "daily-orders-pizzas-number-update" &&
                (
                    <AlertOk message="Numero de pizza alterado com successo" />
                )
            } */}
        </div>

    )
}

interface DailyOrderQuickStatProps {
    label: string
    value: number
    decimalsAmount?: number
}

export function DailyOrderQuickStat({ label, value, decimalsAmount = 2 }: DailyOrderQuickStatProps) {

    const valueRendered = value.toFixed(decimalsAmount)

    return (
        <div className="grid grid-cols-2 items-center gap-x-4">
            <span className="font-medium leading-none tracking-tight">{label}</span>
            <span className="font-semibold leading-none tracking-tight text-right">{valueRendered}</span>
        </div>
    )
}