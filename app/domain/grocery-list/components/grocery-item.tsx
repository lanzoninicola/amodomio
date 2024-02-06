import { useState } from "react"
import { GroceryList, GroceryListItem } from "../grocery-list.model.server"
import { PlusCircleIcon, MinusCircleIcon, TrashIcon } from "lucide-react"
import { Input } from "~/components/ui/input"
import uppercase from "~/utils/to-uppercase"
import { cn } from "~/lib/utils"

interface GroceryItemProps {
    listId: GroceryList["id"]
    item: GroceryListItem
    increaseItemQuantity: (item: GroceryListItem) => void
    decreaseItemQuantity: (item: GroceryListItem) => void
    removeItem: (item: GroceryListItem) => void
}

export default function GroceryItem({ listId, item, increaseItemQuantity, decreaseItemQuantity, removeItem }: GroceryItemProps) {
    // const [quantity, setQuantity] = useState(item.quantity)
    const [showDeleteBtn, setShowDeleteBtn] = useState(false)

    const increaseQuantity = (item: GroceryListItem) => {
        setShowDeleteBtn(false)
        // setQuantity(quantity + 1)
        increaseItemQuantity(item)
    }

    const decreaseQuantity = (item: GroceryListItem) => {
        const nextQuantity = item.quantity - 1

        if (nextQuantity === 0) {
            setShowDeleteBtn(true)
            return
        }

        decreaseItemQuantity(item)
    }

    return (
        <div className="flex w-full">
            {
                showDeleteBtn &&
                (
                    <button
                        className="flex justify-center items-center w-[60px] bg-brand-red px-2 rounded-l-lg"
                        onClick={() => removeItem(item)}
                    >
                        <TrashIcon size={16} />
                    </button>
                )
            }
            {/* <button
                className={
                    cn(
                        "flex justify-center items-center w-[50px] bg-slate-500 px-2 rounded-l-lg",
                        showDeleteBtn && "rounded-none"
                    )
                }
                type="submit"
                name="_action"
                value="item-update"
            >
                <SaveIcon size={16} className="text-white" />
            </button> */}
            <div className="pl-2 pr-4 bg-slate-50 w-full rounded-r-lg">


                <div className="flex justify-between w-full py-2">
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
                        <MinusCircleIcon onClick={() => decreaseQuantity(item)} />
                        <Input type="number" name="quantity" defaultValue={item.quantity} className="bg-white w-16 text-lg text-center" min={0} />
                        <PlusCircleIcon onClick={() => increaseQuantity(item)} />
                    </div>
                </div>
            </div>

        </div>

    )

}