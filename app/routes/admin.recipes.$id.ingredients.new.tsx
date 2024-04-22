import { LoaderArgs } from "@remix-run/node";
import { Form, useNavigate } from "@remix-run/react";
import { PlusSquare, RefreshCcw, RotateCcw } from "lucide-react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import GoBackButton from "~/components/primitives/table-list/action-buttons/go-back-button/go-back-button";
import LinkButton from "~/components/primitives/table-list/action-buttons/link-button/link-button";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import SelectProductUnit from "~/domain/product/components/select-product-unit/select-product-unit";

export async function loader({ request }: LoaderArgs) {

    return null
}

export default function RecipeSingleIngredientsNew() {

    // const navigate = useNavigate()
    // const goBack = () => navigate(-1)

    return (
        <div className="border rounded p-4">
            <Form method="post">
                <Fieldset>
                    <div className="flex justify-between">
                        <Label htmlFor="name" className="pt-2">Nome</Label>
                        <Input name="name" placeholder="Nome" defaultValue={""} className="max-w-[300px]" />
                    </div>
                </Fieldset>

                <Fieldset>
                    <div className="flex justify-between">
                        <Label htmlFor="unit" className="pt-2">UM</Label>
                        <Input name="unit" placeholder="unit" defaultValue={""} className="max-w-[300px]" />
                    </div>
                    <SelectProductUnit />
                </Fieldset>

                <Fieldset>
                    <div className="flex justify-between">
                        <Label htmlFor="quantity" className="pt-2">Quantitade</Label>
                        <Input name="quantity" placeholder="Quantitade" defaultValue={""} className="max-w-[300px]" />
                    </div>
                </Fieldset>

                <div className="flex flex-col md:flex-row gap-4">
                    <GoBackButton labelClassName="uppercase font-semibold tracking-wider text-xs" variant={"outline"} />
                    <SaveItemButton actionName="recipe-add-ingredient" label="Salvar" labelClassName="uppercase font-semibold tracking-wider text-xs" variant={"outline"} />
                </div>

            </Form>



        </div>
    )
}