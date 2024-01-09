import { useState } from "react"
import { GroceryList, GroceryListItem } from "../grocery-list.model.server"
import { PlusCircleIcon, MinusCircleIcon } from "lucide-react"
import { Input } from "~/components/ui/input"
import uppercase from "~/utils/to-uppercase"
import { Button } from "~/components/ui/button"
import { Form } from "@remix-run/react"

interface GroceryItemProps {
    listId: GroceryList["id"]
    item: GroceryListItem
    state: "setting-up" | "purchasing"
}

export default function GroceryItem({ listId, item }: GroceryItemProps) {
    const [quantity, setQuantity] = useState(item.quantity)

    const increaseQuantity = () => {
        setQuantity(quantity + 1)
    }

    const decreaseQuantity = () => {
        const nextQuantity = quantity - 1

        if (nextQuantity < 1) {
            return
        }

        setQuantity(quantity - 1)
    }

    return (
        <Form method="post">
            <div className="py-2 px-4 rounded-lg bg-slate-50 mb-2" data-element={item.id}>
                <input type="hidden" name="listId" value={listId} />
                <input type="hidden" name="itemId" value={item.id} />
                <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col gap-1">
                        <span>{item.name}</span>
                        <span className="text-xs upper">Unidade: {uppercase(item.unit)}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <PlusCircleIcon onClick={increaseQuantity} />
                        <Input type="number" name="quantity" defaultValue={quantity} className="bg-white w-16 text-lg text-center" min={1} />
                        <MinusCircleIcon onClick={decreaseQuantity} />
                    </div>
                </div>
                <button
                    className="flex justify-center bg-red-500 rounded-lg w-full py-1"
                    type="submit"
                    name="_action"
                    value="delete-item"
                >
                    <span className="text-white uppercase text-center text-xs font-semibold">remover</span>
                </button>
                {/* <div className="grid grid-cols-2">
                <span className="text-center text-red-300 font-semibold text-xs uppercase">não comprado</span>
                <span className="text-center text-brand-green font-semibold text-xs uppercase">comprado</span>
            </div> */}
            </div>
        </Form>
    )

}