import { Ingredient } from "@prisma/client";
import { Form } from "@remix-run/react";
import GoBackButton from "~/components/primitives/table-list/action-buttons/go-back-button/go-back-button";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import randomReactKey from "~/utils/random-react-key";

interface IngredientFormProps {
    recipeId: string
    ingredient?: Ingredient
    /** this is used by the input that collect the name of ingredient */
    allIngredients: Ingredient[]
    units: string[]
    actionName: "ingredient-create" | "ingredient-update"
}

export default function IngredientForm({ recipeId, ingredient, units, actionName }: IngredientFormProps) {

    return (

        <Form method="post">
            <input type="hidden" name="recipeId" value={recipeId} />
            <Fieldset className="grid-cols-3">
                <Label htmlFor="name" className="pt-2 flex flex-col gap-1">
                    <span>Nome</span>
                    <span className="text-xs text-muted-foreground">* vai comparir no cardápio</span>
                </Label>
                <Input name="name" placeholder="Nome" defaultValue={""} className="col-span-2" />
            </Fieldset>

            <Fieldset className="grid-cols-3">
                <Label htmlFor="unit" className="pt-2">UM</Label>
                <Select name="um">
                    <SelectTrigger className="col-span-2">
                        <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent id="um">
                        {units.map(u => <SelectItem key={randomReactKey()} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                </Select>

            </Fieldset>

            <Fieldset className="grid-cols-3">
                <Label htmlFor="quantity" className="pt-2">Quantitade</Label>
                <Input name="quantity" placeholder="Quantitade" defaultValue={""} className="col-span-2" />
            </Fieldset>

            <div className="flex flex-col md:flex-row gap-4 mt-8">
                <GoBackButton labelClassName="uppercase font-semibold tracking-wider text-xs" variant={"outline"} />
                <SaveItemButton actionName="recipe-add-ingredient" label="Salvar" labelClassName="uppercase font-semibold tracking-wider text-xs" variant={"outline"} />
            </div>

        </Form>
    )
}

function IngredientNameFieldset() {
    return (
        <Fieldset className="grid-cols-3">
            <Label htmlFor="name" className="pt-2 flex flex-col gap-1">
                <span>Nome</span>
                <span className="text-xs text-muted-foreground">* vai comparir no cardápio</span>
            </Label>
            <Input name="name" placeholder="Nome" defaultValue={""} className="col-span-2" />
        </Fieldset>
    )
}