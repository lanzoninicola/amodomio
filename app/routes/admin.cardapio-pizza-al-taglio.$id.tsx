import { ActionArgs, LoaderArgs } from "@remix-run/node"
import { Form, useActionData, useLoaderData } from "@remix-run/react"
import dayjs from "dayjs"
import { AlertCircle, BadgeCheck, BadgeX, Check, Edit, Plus, Save, X } from "lucide-react"
import { useState } from "react"
import CopyButton from "~/components/primitives/copy-button/copy-button"
import InputItem from "~/components/primitives/form/input-item/input-item"
import TextareaItem from "~/components/primitives/form/textarea-item/textarea-item"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { DeleteItemButton } from "~/components/primitives/table-list"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert"
import Fieldset from "~/components/ui/fieldset"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio, CardapioPizzaSlice } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import FormAddPizzaSliceIntoCardapio from "~/domain/cardapio-pizza-al-taglio/components/form-add-pizza-al-taglio-into-cardapio/form-add-pizza-al-taglio-into-cardapio"
import { PizzaSlice, PizzaSliceCategory } from "~/domain/pizza-al-taglio/pizza-al-taglio.model.server"
import getSearchParam from "~/utils/get-search-param"
import { badRequest, ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"




export async function loader({ request, params }: LoaderArgs) {

    const cardapioId = params.id

    if (!cardapioId) {
        return badRequest("Nenhum cardápio encontrado")
    }

    const [err, record] = await tryit(cardapioPizzaAlTaglioEntity.findById(cardapioId as string))

    if (err) {
        return serverError(err)
    }

    if (!record) {
        return badRequest("Nenhum cardápio encontrado")
    }

    return ok({
        record
    })
}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const cardapioId = values["cardapioId"] as string

    if (_action === "cardapio-publish") {

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.publish(cardapioId))

        if (err) {
            return serverError(err)
        }

        return ok("Registro publicado.")
    }

    if (_action === "cardapio-mask") {

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.mask(cardapioId))

        if (err) {
            return serverError(err)
        }

        return ok("Registro ocultado.")
    }

    if (_action === "cardapio-delete") {

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.delete(cardapioId))

        if (err) {
            return serverError(err)
        }

        return ok("Registro apagado.")
    }

    if (_action === "cardapio-slice-add") {
        const toppings = values["sliceToppings"] as string
        const category = values["sliceCategory"] as PizzaSliceCategory
        const quantity = values["sliceQuantity"] as string

        if (isNaN(Number(quantity))) {
            return serverError("Quantidade inválida")
        }

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceAdd(
            cardapioId,
            {
                toppings,
                category,
            },
            Number(quantity)
        ))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço adiçionado")
    }



    // if (_action === "cardapio-slice-update-toppings") {
    //     const sliceId = values["sliceId"] as string
    //     const toppings = values["sliceToppings"] as string

    //     const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceUpdateToppings(cardapioId, sliceId, toppings))

    //     if (err) {
    //         return serverError(err)
    //     }

    //     return ok("Pedaço atualizado")
    // }

    // if (_action === "cardapio-slice-update-quantity") {
    //     const sliceId = values["sliceId"] as string
    //     const quantity = values["sliceQuantity"] as string

    //     if (isNaN(Number(quantity))) {
    //         return serverError("Quantidade inválida")
    //     }

    //     const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceUpdateQuantity(cardapioId, sliceId, Number(quantity)))

    //     if (err) {
    //         return serverError(err)
    //     }

    //     return ok("Pedaço atualizado")
    // }

    if (_action === "cardapio-slice-update") {
        const sliceId = values["sliceId"] as string
        const toppings = values["sliceToppings"] as string
        const quantity = values["sliceQuantity"] as string

        if (isNaN(Number(quantity))) {
            return serverError("Quantidade inválida")
        }

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceUpdate(cardapioId, sliceId, {
            toppings,
            quantity: Number(quantity)
        }))

        if (err) {
            return serverError(err)
        }

        return ok("Registro publicado.")
    }


    if (_action === "cardapio-slice-delete") {
        const sliceId = values["sliceId"] as string

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceDelete(cardapioId, sliceId))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço removido")
    }

    if (_action === "cardapio-slice-out-of-stock") {
        const sliceId = values["sliceId"] as string

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceOutOfStock(cardapioId, sliceId))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço esgotado")
    }

    if (_action === "cardapio-slice-out-of-stock-recover-slice") {
        const sliceId = values["sliceId"] as string

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceOutOfStockRecover(cardapioId, sliceId))

        if (err) {
            return serverError(err)
        }

        return ok("O pedaçõ voltou disponivel")
    }




    if (_action === "cardapio-slice-out-of-stock-recover-all") {
        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.outOfStockRecover(cardapioId))

        if (err) {
            return serverError(err)
        }

        return ok("Stock disponivel de todos os pedaços")
    }


    return null

}


export default function SingleCardapioPizzaAlTaglio() {
    const loaderData = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const cardapio: CardapioPizzaAlTaglio = loaderData?.payload?.record || undefined

    const pizzaSlices = cardapio?.slices || []

    if (loaderData?.status !== 200) {
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Oops</AlertTitle>
            <AlertDescription>
                {loaderData?.message}
            </AlertDescription>
        </Alert>
    }

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "OK",
            description: actionData.message
        })
    }

    if (loaderData?.status !== 200) {
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Oops</AlertTitle>
            <AlertDescription>
                {loaderData?.message}
            </AlertDescription>
        </Alert>
    }

    const [showEdit, setShowEdit] = useState(true)
    const [showNewPizzaSliceForm, setShowNewPizzaSliceForm] = useState(false)

    return (
        <div className="border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full mt-8">

            <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:grid md:grid-cols-2">
                        <div className="flex flex-col">
                            <h3 className="text-md font-semibold tracking-tight mb-1">{cardapio.name}</h3>
                            {/* @ts-ignore */}
                            <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">{`Criado no dia ${dayjs(cardapio!.createdAt).format("DD/MM/YYYY")}`}</h2>
                        </div>
                        <div className="flex gap-4 items-center justify-end">
                            <CopyButton
                                label="Copiar elenco para imprimir"
                                classNameLabel="text-sm md:text-xs "
                                classNameButton="px-4 hover:bg-muted"
                                textToCopy={pizzaSliceTextToPrint(cardapio)}
                                variant="outline"
                            />
                            <Form method="post" className="flex flex-col md:flex-row gap-4 ">
                                <input type="hidden" name="cardapioId" value={cardapio.id} />
                                <SubmitButton actionName={cardapio.public === true ? "cardapio-mask" : "cardapio-publish"}
                                    idleText={cardapio.public === true ? "Ocultar" : "Publicar"}
                                    loadingText={cardapio.public === true ? "Ocultando" : "Publicando"}
                                    icon={<BadgeCheck size={14} />}
                                    className="w-full uppercase font-semibold tracking-wide text-xs"

                                />
                                {/* {
                            someIsNotAvailable === true && (
                                <SubmitButton
                                    className="col-span-2"
                                    actionName="cardapio-slice-out-of-stock-recover-all"
                                    idleText="Restorar estoque"
                                    loadingText="Restorando..."
                                    icon={<Check />} />
                            )
                        } */}
                            </Form>

                        </div>

                    </div>
                    <Separator className="mb-6" />
                </div>
                <div className="flex flex-col gap-2">
                    <section className="flex gap-4 items-center mb-4">
                        <div className="flex gap-1 items-center cursor-pointer hover:underline" onClick={() => setShowNewPizzaSliceForm(!showNewPizzaSliceForm)}>
                            <Plus size={14} />
                            <span className="text-xs md:text-md">{showNewPizzaSliceForm === false ? "Novo Sabor" : "Fechar formúlario"}</span>
                        </div>

                        <div className="flex gap-1 items-center cursor-pointer hover:underline" onClick={() => setShowEdit(!showEdit)}>
                            <Edit size={14} />
                            <span className="text-xs md:text-md">{showEdit === false ? "Abilitar alterações" : "Desabilitar alterações"}</span>

                        </div>

                    </section>
                    <section className="flex flex-col gap-2">
                        {showNewPizzaSliceForm &&
                            <FormAddPizzaSliceIntoCardapio cardapio={cardapio} />
                        }


                        <ul className="flex flex-col md:grid md:grid-cols-2 gap-4">
                            {
                                pizzaSlices.map((slice: CardapioPizzaSlice) => {
                                    return (
                                        <li key={slice.id} >
                                            <Form method="post" className="rounded-lg border border-muted-foreground text-xs md:text-base items-center mb-2 p-4">
                                                <input type="hidden" name="cardapioId" value={cardapio.id} />
                                                <input type="hidden" name="sliceId" value={slice.id} />
                                                <div className="flex flex-col gap-2 w-full">
                                                    <Fieldset className="md:grid md:grid-cols-4 items-start w-full">
                                                        {showEdit === true && (<Label htmlFor="sliceToppings" className="text-xs">Sabor</Label>)}
                                                        <TextareaItem type="text" rows={2}
                                                            id="sliceToppings"
                                                            className="leading-tight col-span-3 text-sm" name="sliceToppings"
                                                            defaultValue={slice.toppings}
                                                            disabled={showEdit === false}
                                                        />
                                                    </Fieldset>
                                                    {
                                                        showEdit === true && (
                                                            <Fieldset className="md:grid md:grid-cols-4 items-center">
                                                                <Label htmlFor="sliceQuantity" className="text-xs">Quantitade</Label>
                                                                <InputItem type="text"
                                                                    id="sliceQuantity"
                                                                    className="text-sm max-w-[50px]" name="sliceQuantity"
                                                                    defaultValue={slice.quantity}
                                                                    autoComplete="yep"
                                                                />
                                                            </Fieldset>
                                                        )
                                                    }
                                                </div>
                                                <Separator className="my-4" />
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <SubmitButton
                                                        className="md:max-w-none"
                                                        actionName="cardapio-slice-out-of-stock" idleText="Esgotar" loadingText="Esgotando..."
                                                        variant={"outline"}
                                                        disabled={slice.isAvailable === false}
                                                        icon={<X size={16} />} />
                                                    <SubmitButton
                                                        className="md:max-w-none"
                                                        actionName="cardapio-slice-out-of-stock-recover-slice" idleText="Restorar" loadingText="Restorando..."
                                                        disabled={slice.isAvailable === true}
                                                        icon={<Check size={16} />} />
                                                </div>

                                                {
                                                    showEdit === true && (
                                                        <>
                                                            <Separator className="my-4" />
                                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                                <SubmitButton
                                                                    className="md:max-w-none text-xs"
                                                                    actionName="cardapio-slice-update" idleText="Atualizar" loadingText="Atualizando..."
                                                                    variant={"outline"}
                                                                    icon={<Save size={16} />}

                                                                />
                                                                <DeleteItemButton
                                                                    actionName="cardapio-slice-delete"
                                                                    variant={"outline"}
                                                                    label="Deletar"
                                                                    className="border-red-100"
                                                                />
                                                            </div>
                                                            {/* <div className="flex gap-2 items-center justify-evenly col-span-2">
                                                                <div className="flex flex-col gap-0">
                                                                    <span className="text-xs">Sabores</span>
                                                                    <SaveItemButton actionName="cardapio-slice-update-toppings" tooltipLabel="Atualizar Sabores" />
                                                                </div>
                                                                <div className="flex flex-col gap-0">
                                                                    <span className="text-xs">Quantitade</span>
                                                                    <SaveItemButton actionName="cardapio-slice-update-quantity" tooltipLabel="Atualizar Quantitade" />
                                                                </div>
                                                                <div className="flex flex-col gap-0">
                                                                    <span className="text-xs text-red-500">Deletar</span>
                                                                    <DeleteItemButton actionName="cardapio-slice-delete" />
                                                                </div>

                                                            </div> */}
                                                        </>

                                                    )
                                                }

                                            </Form>
                                        </li>
                                    )
                                })
                            }
                        </ul>
                    </section>

                </div>
                <Form method="post">
                    <input type="hidden" name="cardapioId" value={cardapio.id} />
                    <div className="w-full flex justify-end">
                        <div className="flex gap-0 items-center hover:bg-red-200 rounded-md p-1 cursor-pointer">
                            <span className="text-xs text-red-500 ">Deletar o cardápio</span>
                            <DeleteItemButton actionName="cardapio-delete" />
                        </div>
                    </div>
                </Form>
                {/* <Badge className={
                            cn(
                                "w-max",
                                category.type === "menu" ? "bg-brand-green" : "bg-brand-blue",
                            )
                        }>{category.type}</Badge> */}

            </div>
        </div>
        // </Link>
    )
}

function pizzaSliceTextToPrint(cardapio: CardapioPizzaAlTaglio) {

    const vegetarianSlices = cardapio.slices.filter(s => s.category === "vegetariana")
    const meatSlices = cardapio.slices.filter(s => s.category === "carne")
    const margheritaSlices = cardapio.slices.filter(s => s.category === "margherita")

    let text = ``

    if (vegetarianSlices.length > 0) {
        const vegetarianSlicesText = vegetarianSlices.map(s => {
            return `- ${s.toppings}\n`
        })

        text += `*Vegetariana\n${vegetarianSlicesText.join("")}\n`
    }

    if (meatSlices.length > 0) {
        const meatSlicesText = meatSlices.map(s => {
            return `- ${s.toppings}\n`
        })
        text += `*Com carne\n${meatSlicesText.join("")}\n`
    }

    if (margheritaSlices.length > 0) {
        const margheritaSlicesText = margheritaSlices.map(s => {
            return `- ${s.toppings}\n`
        })
        text += `*Margherita\n${margheritaSlicesText.join("")}\n`
    }

    return text
}
