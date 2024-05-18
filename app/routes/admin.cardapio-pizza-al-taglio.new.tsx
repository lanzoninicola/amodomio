
import { ActionArgs, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

import { toast } from "~/components/ui/use-toast";
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server";
import { now } from "~/lib/dayjs";
import { serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "cardapio-create") {
        const [err, record] = await tryit(cardapioPizzaAlTaglioEntity.addCardapio({
            public: values.public === "on" ? true : false,
            name: values.name as string,
            slices: [],
        }))

        if (err) {
            return serverError(err)
        }

        if (record.public === true) {
            return redirect(`/admin/cardapio-pizza-al-taglio`)
        }

        return redirect(`/admin/cardapio-pizza-al-taglio/${record.id}`)
    }

    return null
}

export default function CardapioPizzaAlTaglioNew() {
    const actionData = useActionData<typeof action>()

    if (actionData && actionData?.status !== 200) {
        toast({
            title: "Erro",
            description: actionData?.message,
        })
    }

    if (actionData && actionData?.status === 200) {
        toast({
            title: "OK",
            description: actionData?.message
        })
    }

    return (
        <Form method="post" className="rounded border p-4 md:max-w-xl mt-4">
            <h3 className="text-sm text-muted-foreground font-semibold mb-4">Novo cardápio</h3>
            <Fieldset className="grid-cols-3">
                <Label htmlFor="name">Nome</Label>
                <Input type="text" id="name" name="name" required className="col-span-2" defaultValue={`Cardápio do dia ${now()}`} />
            </Fieldset>
            <Fieldset className="grid-cols-3">
                <Label htmlFor="public">Publico</Label>
                <Switch id="public" name="public" />
            </Fieldset>
            <SubmitButton actionName="cardapio-create" className="mb-4" />
        </Form>
    )
}

/*
function PizzaSlicesSelector() {
    const loaderData = useLoaderData<typeof loader>()
    const pizzaSlices: CardapioPizzaSlice[] = loaderData?.payload?.records || []

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

        const isVegetariana = () => itemFound?.category === "vegetariana"
        const isCarne = () => itemFound?.category === "carne"
        const isMargherita = () => itemFound?.category === "margherita"


        if (action === "increase") {
            nextQuantity = String(Number(itemFound?.quantity || 0) + 1)

            setToppingsAmount({
                ...toppingsAmount,
                vegetarian: isVegetariana() ? toppingsAmount.vegetarian + 1 : toppingsAmount.vegetarian,
                meat: isCarne() ? toppingsAmount.meat + 1 : toppingsAmount.meat,
                margherita: isMargherita() ? toppingsAmount.margherita + 1 : toppingsAmount.margherita,
            })
        }

        if (action === "decrease") {
            nextQuantity = String(Number(itemFound?.quantity || 0) - 1)

            setToppingsAmount({
                ...toppingsAmount,
                vegetarian: isVegetariana() ? toppingsAmount.vegetarian - 1 : toppingsAmount.vegetarian,
                meat: isCarne() ? toppingsAmount.meat - 1 : toppingsAmount.meat,
                margherita: isMargherita() ? toppingsAmount.margherita - 1 : toppingsAmount.margherita,
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
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 md:mb-2">
                            <SubmitButton actionName="cardapio-create" className="mb-4" />
                            <div className="flex text-sm leading-snug gap-4 items-center">
                                <span className="font-semibold text-sm">{`Total: ${toppingsAmount.margherita + toppingsAmount.vegetarian + toppingsAmount.meat}`}</span>
                                <span className="text-xs">{`Margherita: ${toppingsAmount.margherita}`}</span>
                                <span className="text-xs">{`Vegetariana: ${toppingsAmount.vegetarian}`}</span>
                                <span className="text-xs">{`Carne: ${toppingsAmount.meat}`}</span>
                            </div>
                        </div>
                        <Separator className="hidden md:block" />

                    </div>
                    <ul className="mt-24 md:mt-20">
                        {
                            pizzaSlices.map((pizza) => {
                                return (
                                    <li key={pizza.id} className="flex flex-col md:grid md:grid-cols-4 md:gap-4 md:items-center md:max-w-3xl mb-2" >
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
            <div className="flex flex-col gap-1 md:max-w-xs col-span-2 mb-2">
                <span className="text-sm font-semibold leading-tight md:leading-normal">{pizza.toppings}</span>
                <span className="text-xs">{pizza.category}</span>

            </div>

            <span className="text-xs text-muted-foreground">{formatDate(pizza.createdAt)}</span>
            <div className="flex gap-2 items-center justify-end md:justify-start">
                <MinusCircleIcon onClick={() => changeQuantity(pizza, "decrease")} className="hover:text-slate-500 cursor-pointer" />
                <Input type="text" value={pizza.quantity || "0"} className="bg-white w-16 text-lg text-center border-none outline-none" min={0} readOnly />
                <PlusCircleIcon onClick={() => changeQuantity(pizza, "increase")} className="hover:text-slate-500 cursor-pointer" />
            </div>
        </>

    )
}

*/