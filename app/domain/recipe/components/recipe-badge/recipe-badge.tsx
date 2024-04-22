import { Recipe } from "@prisma/client"
import Badge from "~/components/primitives/badge/badge"
import { cn } from "~/lib/utils"

interface RecipeItemProps {
    item: Recipe
}

export default function RecipeBadge({ item }: RecipeItemProps) {

    const label = item.type === "pizzaTopping" ? "Sabor" : "Produzido"

    return (
        <Badge className={
            cn(
                "w-max",
                item.type === "pizzaTopping" && "bg-brand-yellow",
                item.type === "semiFinished" && "bg-brand-orange",

            )
        }>{label}</Badge>

    )
}