import { cn } from "~/lib/utils"
import type { ProductInfo } from "../../product.model.server"
import { getProductTypeLabel } from "~/modules/products/product.constants"

interface ProductTypeBadgeProps {
    type?: ProductInfo["type"] | null
}

export default function ProductTypeBadge({ type }: ProductTypeBadgeProps) {

    const backgroundColor = {
        pizza: "bg-violet-100",
        topping: "bg-orange-100",
        ingredient: "bg-blue-100",
        processed: "bg-blue-300",
        simple: "bg-green-100",
    }

    return (
        <span className={
            cn(
                "px-4 py-1 rounded-full text-xs text-gray-800 font-semibold tracking-wide max-w-max",
                type ? backgroundColor[type] : "bg-red-200",
            )
        }>
            {getProductTypeLabel(type)}
        </span>
    )
}
