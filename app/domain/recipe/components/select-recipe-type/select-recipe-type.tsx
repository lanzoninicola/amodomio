import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { RecipeType } from "@prisma/client";
import { cn } from "~/lib/utils";
import { RecipeUtilsEntity } from "../../recipe-utils.entity";


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
                    RecipeUtilsEntity.getTypes().map(t => (
                        <SelectItem key={t.key} value={t.key}>{t.value}</SelectItem>
                    ))
                }
            </SelectContent>
        </Select>
    )
}
