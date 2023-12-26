import { LoaderArgs, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { now } from "~/lib/dayjs";


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "daily-orders-create") {
        const dailyOrder: DailyOrder = {
            date: now(),
            initialLargePizzaNumber: Number(values.initialLargePizzaNumber),
            restLargePizzaNumber: Number(values.initialLargePizzaNumber),
            initialMediumPizzaNumber: Number(values.initialMediumPizzaNumber),
            restMediumPizzaNumber: Number(values.initialMediumPizzaNumber),
            totalOrdersNumber: 0,
            totalOrdersAmount: 0,
            totalMotoboyAmount: 0,
            transactions: []
        }

        await dailyOrderEntity.create(dailyOrder)

        return redirect(`/admin/daily-orders/${dailyOrder.id}`)
    }

    return null
}


export default function DailyOrdersSingleNew() {

    const [mediumPizzaNumber, setMediumPizzaNumber] = useState(0)
    const [largePizzaNumber, setLargePizzaNumber] = useState(0)


    const submitButtonDisabled = largePizzaNumber === 0 && mediumPizzaNumber === 0

    return (
        <div className="mx-64">
            <Form method="post" className="flex flex-col items-center mb-8 bg-slate-50 py-12 px-6 rounded-xl">
                <div className="flex flex-col gap-4 mb-6">
                    <h2 className="font-semibold text-md">Indicar o numero de pizzas</h2>
                    <div className="flex gap-12 mb-6 w-full justify-between">

                        <div className="flex gap-4 items-center">
                            <span>Pizzas Familía</span>
                            <Input type="text" id="largePizzaNumber" maxLength={2} className="w-[72px] bg-white" onChange={(e) => {
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
                            <Input type="text" id="mediumPizzaNumber" maxLength={2} className="w-[72px] bg-white" onChange={(e) => {
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
                <SubmitButton actionName="daily-orders-create" idleText="Abrir o dia" loadingText="Abrindo..." disabled={submitButtonDisabled} />
            </Form>
        </div>
    )
}

