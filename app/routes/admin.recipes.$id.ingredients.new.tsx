import { Ingredient } from "@prisma/client";
import { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import { AlertCircle } from "lucide-react";
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
import { recipeIngredientEntity } from "~/domain/recipe/recipe-ingredient.entity";
import SelectUM from "~/domain/unit-of-measurement/components/select-um/select-um";
import { umEntity } from "~/domain/unit-of-measurement/um.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { HttpResponse, badRequest, ok } from "~/utils/http-response.server";
import randomReactKey from "~/utils/random-react-key";

export async function loader({ params }: LoaderArgs) {
    const units = umEntity.units()

    const recipeId = params?.id

    if (!recipeId) {
        return badRequest("admin.recipe.$id.ingredients.new: ID da receita desconhecido")
    }

    const [err, allIngredients] = await prismaIt(recipeIngredientEntity.findAll())

    return ok({
        recipeId,
        allIngredients,
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
    const allIngredients = loaderData?.payload?.allIngredients as Ingredient[]

    if (loaderData?.status !== 200) {
        return (
            <div className="grid place-items-center px-4 py-16">
                <div className="flex flex-col gap-4 rounded border p-6">
                    <div className="flex gap-2 text-red-500">
                        <AlertCircle />
                        <p className="font-semibold">{loaderData?.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">recipeId variable value: {!recipeId ? "undefined" : recipeId}</span>
                </div>
            </div>
        )
    }

    // const navigate = useNavigate()
    // const goBack = () => navigate(-1)

    return (
        <div className="border rounded p-4">
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



        </div>
    )
}