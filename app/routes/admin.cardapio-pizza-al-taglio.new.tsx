
import { ActionArgs, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { MinusCircleIcon, PlusCircleIcon } from "lucide-react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";

import { toast } from "~/components/ui/use-toast";
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server";
import { CardapioPizzaSlice } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server";
import { pizzaSliceEntity } from "~/domain/pizza-al-taglio/pizza-al-taglio.entity.server";
import { now } from "~/lib/dayjs";
import { serverError, ok } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";


export async function loader() {

    const [err, records] = await tryit(pizzaSliceEntity.findAll())


    if (err) {
        return serverError(err)
    }

    return ok({
        records
    })
}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "cardapio-create") {
        const slices = jsonParse(values.pizzaSlicesState) as unknown as CardapioPizzaSlice[]

        const [err, _] = await tryit(cardapioPizzaAlTaglioEntity.add({
            slices
        }))

        if (err) {
            return serverError(err)
        }

        return redirect("/admin/cardapio-pizza-al-taglio")
    }

    return null
}

export default function CardapioPizzaAlTaglioNew() {
    const loaderData = useLoaderData<typeof loader>()
    const pizzaSlices: CardapioPizzaSlice[] = loaderData?.payload?.records || []
    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "OK",
            description: actionData.message
        })
    }

    const [itemsChoosable, setItemsChoosable] = useState<CardapioPizzaSlice[]>(pizzaSlices)

    const [toppingsAmount, setToppingsAmount] = useState({
        "vegetarian": 0,
        "meat": 0,
        "margherita": 0
    })

    const changeQuantity = (item: CardapioPizzaSlice, action: "increase" | "decrease") => {
        const itemFound = itemsChoosable.find(i => i.id === item.id)
        let nextQuantity = "0"
        // const nextQuantity = action === "increase" ?
        //     String(Number(itemFound?.quantity || 0) + 1) :
        //     String(Number(itemFound?.quantity || 0) - 1)

        if (action === "increase") {
            nextQuantity = String(Number(itemFound?.quantity || 0) + 1)

            setToppingsAmount({
                ...toppingsAmount,
                vegetarian: itemFound?.toppings === "vegetarian" ? toppingsAmount.vegetarian + 1 : toppingsAmount.vegetarian,
                meat: itemFound?.toppings === "meat" ? toppingsAmount.meat + 1 : toppingsAmount.meat,
                margherita: itemFound?.toppings === "margherita" ? toppingsAmount.margherita + 1 : toppingsAmount.margherita,
            })
        }

        if (action === "decrease") {
            nextQuantity = String(Number(itemFound?.quantity || 0) - 1)

            setToppingsAmount({
                ...toppingsAmount,
                vegetarian: itemFound?.toppings === "vegetarian" ? toppingsAmount.vegetarian - 1 : toppingsAmount.vegetarian,
                meat: itemFound?.toppings === "meat" ? toppingsAmount.meat - 1 : toppingsAmount.meat,
                margherita: itemFound?.toppings === "margherita" ? toppingsAmount.margherita - 1 : toppingsAmount.margherita,
            })
        }


        const nextItem = {
            ...item,
            quantity: nextQuantity
        }

        setItemsChoosable([
            ...itemsChoosable.filter(i => i.id !== item.id),
            nextItem
        ])
    }

    return (
        <div className="flex flex-col gap-6 max-h-[350px] p-4 md:p-6 border rounded-lg">
            <Form method="post" className="overflow-auto">
                <input type="hidden" name={`pizzaSlicesState`} value={jsonStringify(itemsChoosable.filter(i => Number(i.quantity) > 0))} />
                <div className="flex flex-col gap-4 ">
                    <div className="fixed bg-white w-[320px] md:w-[720px]">
                        <div className="flex justify-between items-center mb-2">
                            <SubmitButton actionName="cardapio-create" className="mb-4" />
                            <div className="flex text-sm leading-snug gap-4">
                                <span>{`Margherita: ${toppingsAmount.margherita}`}</span>
                                <span>{`Vegetariana: ${toppingsAmount.vegetarian}`}</span>
                                <span>{`Carne: ${toppingsAmount.meat}`}</span>
                            </div>
                        </div>
                        <Separator className="hidden md:block" />

                    </div>
                    <ul className="mt-16">
                        {
                            pizzaSlices.map((pizza) => {
                                return (
                                    <li key={pizza.id} className="flex justify-between mb-4 items-center max-w-xl ">
                                        <FormPizzaSliceRow pizza={itemsChoosable.find(i => i.id === pizza.id)} changeQuantity={changeQuantity} />
                                    </li>
                                )
                            })
                        }
                    </ul>
                </div>
            </Form>
        </div>


    )
}

interface FormPizzaSliceRowProps {
    pizza: CardapioPizzaSlice | undefined,
    changeQuantity: (item: CardapioPizzaSlice, action: "increase" | "decrease") => void,
}

function FormPizzaSliceRow({ pizza, changeQuantity }: FormPizzaSliceRowProps) {
    if (!pizza) {
        return null
    }

    return (
        <>
            <div className="flex flex-col gap-1 md:max-w-xs">
                <span className="text-sm font-semibold leading-tight md:leading-normal">{pizza.toppings}</span>
                <span className="text-xs">{pizza.category}</span>

            </div>
            <div>
                <div className="flex gap-2 items-center">
                    <MinusCircleIcon onClick={() => changeQuantity(pizza, "decrease")} className="hover:text-slate-500 cursor-pointer" />
                    <Input type="text" value={pizza.quantity || "0"} className="bg-white w-16 text-lg text-center border-none outline-none" min={0} readOnly />
                    <PlusCircleIcon onClick={() => changeQuantity(pizza, "increase")} className="hover:text-slate-500 cursor-pointer" />
                </div>
            </div>
        </>

    )
}