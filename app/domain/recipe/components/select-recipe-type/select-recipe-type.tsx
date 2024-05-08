import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { RecipeEntity } from "../../recipe.entity";
import { RecipeType } from "@prisma/client";
import { cn } from "~/lib/utils";


interface SelectRecipeTypeProps {
    defaultValue?: RecipeType
    className?: string
}


export default function SelectRecipeType({ defaultValue, className }: SelectRecipeTypeProps) {

    return (
        <Select name="type" required={true} defaultValue={defaultValue || ""}>
            <SelectTrigger id="type" className={
                cn(
                    className,
                )
            }>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent >
                {
                    RecipeEntity.getTypes().map(t => (
                        <SelectItem key={t.key} value={t.key}>{t.value}</SelectItem>
                    ))
                }
            </SelectContent>
        </Select>
    )
}
