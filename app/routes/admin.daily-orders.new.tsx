import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DOTOperator, DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { now } from "~/lib/dayjs";
import { AdminOutletContext } from "./admin";
import { serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import useFormResponse from "~/hooks/useFormResponse";
import { Select, SelectContent, SelectGroup, SelectTrigger, SelectValue, SelectItem } from "~/components/ui/select";
import dotOperators from "~/domain/daily-orders/dot-operators";
import { AlertError } from "~/components/layout/alerts/alerts";


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "daily-orders-create") {

        if (!values.date) {
            return serverError({ message: "Data não informada" })
        }

        const operator = dotOperators(values.operatorId as string) as DOTOperator

        const dailyOrder: DailyOrder = {
            date: values.date as string,
            initialLargePizzaNumber: Number(values.initialLargePizzaNumber || 0),
            restLargePizzaNumber: Number(values.initialLargePizzaNumber || 0),
            initialMediumPizzaNumber: Number(values.initialMediumPizzaNumber || 0),
            restMediumPizzaNumber: Number(values.initialMediumPizzaNumber || 0),
            totalOrdersNumber: 0,
            totalOrdersAmount: 0,
            totalMotoboyAmount: 0,
            operator: operator,
            transactions: []
        }

        const [err, dailyOrderCreated] = await tryit(dailyOrderEntity.createDailyOrder(dailyOrder))

        if (err) {
            return serverError(err)
        }

        return redirect(`/admin/daily-orders/${dailyOrderCreated?.id}?op=${operator.id}`)
    }

    return null
}


export default function DailyOrdersSingleNew() {
    const [operatorId, setOperatorId] = useState("")
    const [mediumPizzaNumber, setMediumPizzaNumber] = useState(0)
    const [largePizzaNumber, setLargePizzaNumber] = useState(0)

    const submitButtonDisabled = (largePizzaNumber === 0 && mediumPizzaNumber === 0) || operatorId === ""

    const formResponse = useFormResponse()

    const operators = dotOperators() as DOTOperator[]


    return (
        <div className="grid place-items-center w-full">
            <Form method="post" className="flex flex-col mt-32 items-center" >
                <div className="flex flex-col gap-4 mb-6">

                    <div className="flex flex-col items-center mb-4">
                        <div className="flex gap-x-4">
                            <span className="text-3xl tracking-tight font-semibold">Bem vindo,</span>

                            <Select name="operatorId" onValueChange={v => setOperatorId(v)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Selecionar operador" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {operators.map((o) =>
                                            <SelectItem key={o.id} value={String(o.id)} className="text-xl cursor-pointer">{o.name}</SelectItem>
                                        )}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-x-4 items-center mb-6">
                        <span className="text-xl tracking-tight text-gray-500">vamos registrar os pedidos do día</span>
                        <Input type="text" id="date" name="date" defaultValue={now()} className="w-[180px] border-none text-center text-xl tracking-wide" />
                    </div>

                    <div>
                        <h2 className="font-semibold text-md mb-4 tracking-tight">Por favor, indicar o numero de pizzas</h2>
                        <div className="flex gap-12 mb-6 w-full justify-between">


                            <div className="flex gap-4 items-center">
                                <span>Pizzas Familía</span>
                                <Input type="text" id="largePizzaNumber" name="initialLargePizzaNumber" maxLength={2} className="w-[72px] bg-white" onChange={(e) => {
                                    const value = Number(e.target.value)

                                    if (Number.isNaN(value)) {
                                        setLargePizzaNumber(0)
                                        return
                                    }

                                    if (value < 0) return

                                    setLargePizzaNumber(value)
                                }} />
                            </div>
                            <div className="flex gap-4 items-center">
                                <span>Pizzas Média</span>
                                <Input type="text" id="mediumPizzaNumber" name="initialMediumPizzaNumber" maxLength={2} className="w-[72px] bg-white" onChange={(e) => {
                                    const value = Number(e.target.value)

                                    if (Number.isNaN(value)) {
                                        setMediumPizzaNumber(0)
                                        return
                                    }

                                    if (value < 0) return

                                    setMediumPizzaNumber(value)
                                }} />
                            </div>
                        </div>
                    </div>
                </div >
                <SubmitButton actionName="daily-orders-create" idleText="Abrir o dia" loadingText="Abrindo..." disabled={submitButtonDisabled} />
                {
                    formResponse?.isError && (
                        <div className="md:max-w-md mt-6">
                            <AlertError message={formResponse.errorMessage} title="Erro!" position="top" />
                        </div>

                    )
                }
            </Form >

        </div >
    )
}

