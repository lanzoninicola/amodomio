import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { RecipeEntity } from "../../recipe.entity";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "@radix-ui/react-label";
import { RecipeType } from "@prisma/client";


interface SelectRecipeTypeProps {
    withLabel?: boolean
    type: RecipeType
}


export default function SelectRecipeType({ withLabel, type }: SelectRecipeTypeProps) {

    console.log({ type })

    if (withLabel === true) {
        return (
            <LabelHtml>
                <SelectHtml type={type} />
            </LabelHtml>
        )
    }

    return <SelectHtml type={type} />
}

interface SelectHtmlProps {
    type: RecipeType
}

function SelectHtml({ type }: SelectHtmlProps) {

    return (
        <Select name="type" required defaultValue={type}>
            <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent >
                <SelectGroup >
                    {
                        RecipeEntity.getTypes().map(t => (
                            <SelectItem key={t.key} value={t.key}>{t.value}</SelectItem>
                        ))
                    }
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}

interface LabelHtmlProps {
    children: React.ReactNode
}

function LabelHtml({ children }: LabelHtmlProps) {

    return (
        <Fieldset>
            <div className="flex flex-row gap-4">
                <Label htmlFor="recipe-type" className="pt-2">Tipo</Label>
                {children}
            </div>
        </Fieldset>
    )

}