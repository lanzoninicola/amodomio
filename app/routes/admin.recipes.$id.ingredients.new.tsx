import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import { PlusSquare, RefreshCcw, RotateCcw } from "lucide-react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import GoBackButton from "~/components/primitives/table-list/action-buttons/go-back-button/go-back-button";
import LinkButton from "~/components/primitives/table-list/action-buttons/link-button/link-button";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import SelectProductUnit from "~/domain/product/components/select-product-unit/select-product-unit";
import SelectUM from "~/domain/unit-of-measurement/components/select-um/select-um";
import { umEntity } from "~/domain/unit-of-measurement/um.entity.server";
import { cn } from "~/lib/utils";
import { HttpResponse, ok } from "~/utils/http-response.server";
import randomReactKey from "~/utils/random-react-key";

export async function loader({ params }: LoaderArgs) {
    const units = umEntity.units()

    const recipeId = params?.id

    if (!recipeId) {
        return null
    }

    return ok({
        recipeId,
        units
    })
}

export async function action({ request, params }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log({ values })

    // manca la parte che associo all'ingrediente il prodotto di riferimento

    return null
}

export default function RecipeSingleIngredientsNew() {

    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()

    const recipeId = loaderData?.payload?.recipeId as string
    const units = loaderData?.payload?.units as string[] || []

    console.log(units)


    // const navigate = useNavigate()
    // const goBack = () => navigate(-1)

    return (
        <div className="border rounded p-4">
            <Form method="post">
                <input type="hidden" name="recipeId" value={recipeId} />
                <Fieldset className="grid-cols-3">
                    <Label htmlFor="name" className="pt-2">Nome</Label>
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



        </div>
    )
}