import { useReducer, useRef, useState } from "react"
import { GroceryList, GroceryListItem } from "../grocery-list.model.server"
import { PlusCircleIcon, MinusCircleIcon, Trash2Icon, TrashIcon, SaveIcon } from "lucide-react"
import { Input } from "~/components/ui/input"
import uppercase from "~/utils/to-uppercase"
import { Button } from "~/components/ui/button"
import { Form } from "@remix-run/react"
import { cn } from "~/lib/utils"

interface GroceryItemProps {
    listId: GroceryList["id"]
    item: GroceryListItem
    state: "setting-up" | "purchasing"
}

export default function GroceryItem({ listId, item }: GroceryItemProps) {
    const [quantity, setQuantity] = useState(item.quantity)
    const [showDeleteBtn, setShowDeleteBtn] = useState(false)

    const increaseQuantity = () => {
        setShowDeleteBtn(false)
        setQuantity(quantity + 1)
    }

    const decreaseQuantity = () => {
        const nextQuantity = quantity - 1

        if (nextQuantity < 1) {
            setShowDeleteBtn(true)
            setQuantity(0)
            return
        }

        setQuantity(quantity - 1)
    }

    return (
        <Form method="post">
            <div className="flex w-full">
                {
                    showDeleteBtn &&
                    (
                        <button
                            className="flex justify-center items-center w-[60px] bg-brand-red px-2 rounded-l-lg"
                            type="submit"
                            name="_action"
                            value="item-delete"
                        >
                            <TrashIcon size={16} />
                        </button>
                    )
                }
                <button
                    className={
                        cn(
                            "flex justify-center items-center w-[50px] bg-slate-500 px-2 rounded-l-lg",
                            showDeleteBtn && "rounded-none"
                        )
                    }
                    type="submit"
                    name="_action"
                    value="item-save"
                >
                    <SaveIcon size={16} className="text-white" />
                </button>
                <div className="pl-2 pr-4 bg-slate-50 w-full rounded-r-lg">


                    <div className="flex justify-between w-full py-2">
                        <input type="hidden" name="listId" value={listId} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <div className="flex flex-col gap-1">
                            <span className={
                                cn(
                                    showDeleteBtn && "text-sm"
                                )
                            }>
                                {item.name}
                            </span>
                            <span className="text-xs upper">Unidade: {uppercase(item.unit)}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <PlusCircleIcon onClick={increaseQuantity} />
                            <Input type="number" name="quantity" defaultValue={quantity} className="bg-white w-16 text-lg text-center" min={1} />
                            <MinusCircleIcon onClick={decreaseQuantity} />
                        </div>
                    </div>
                </div>

            </div>
        </Form>
    )

}