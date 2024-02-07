import { Form } from "@remix-run/react"
import InputItem from "~/components/primitives/form/input-item/input-item"
import { Label } from "~/components/ui/label"
import { CardapioPizzaAlTaglio } from "../../cardapio-pizza-al-taglio.model.server"
import { useState } from "react"
import { MinusCircleIcon, PlusCircleIcon } from "lucide-react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { ObjectId } from "mongodb"

interface CardapioPizzaAlTaglioFormProps {
    action: "cardapio-create" | "cardapio-update"
    cardapio?: CardapioPizzaAlTaglio
}

export default function CardapioPizzaAlTaglioForm({ action, cardapio }: CardapioPizzaAlTaglioFormProps) {

    const [toppingsNumber, setToppingsNumber] = useState(1)

    return (
        <div className="max-w-2xl">
            <Form method="post" >
                <input type="hidden" name="id" value={new ObjectId(cardapio?._id).toString()} />
                <input type="hidden" name="toppingNumbers" value={toppingsNumber} />
                <div className="flex flex-col gap-4 w-full ">
                    {
                        Array.from({ length: toppingsNumber }, (_, i) => (
                            <div className="flex flex-col gap-2 items-center md:flex-row">
                                <InputItem key={i} type="text" name={`topping_${i + 1}`} defaultValue={cardapio?.slices[i].topping || ""} required
                                    className="md:min-w-[350px]"
                                />
                                {/* <SelectPizzaAlTaglioCategory name={`category_${i + 1}`} className="md:min-w-[130px]" /> */}
                            </div>
                        )).map((input, i) => (
                            <div key={i} className="flex gap-4 items-center justify-between">
                                <div className="flex flex-col md:flex-row gap-2 md:items-center mr-2">
                                    <Label htmlFor={`topping_${i + 1}`} className="min-w-[70px] font-semibold text-sm">{`Sabor ${i + 1}`}</Label>
                                    {input}
                                </div>
                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setToppingsNumber(toppingsNumber + 1)}><PlusCircleIcon /></button>
                                    <button type="button" onClick={() => setToppingsNumber(toppingsNumber - 1)}><MinusCircleIcon /></button>
                                </div>
                            </div>
                        ))
                    }
                </div>
                <SubmitButton actionName={action} className="mt-4" />
            </Form>
        </div>
    )
}