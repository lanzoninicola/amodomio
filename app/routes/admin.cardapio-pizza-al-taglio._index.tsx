import { ActionArgs, LoaderArgs } from "@remix-run/node"
import { Form, useActionData, useLoaderData } from "@remix-run/react"
import dayjs from "dayjs"
import { BadgeCheck, BadgeX, Check, Edit, Eye, EyeOff, X } from "lucide-react"
import { useState } from "react"
import CopyButton from "~/components/primitives/copy-button/copy-button"
import InputItem from "~/components/primitives/form/input-item/input-item"
import TextareaItem from "~/components/primitives/form/textarea-item/textarea-item"

import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { DeleteItemButton } from "~/components/primitives/table-list"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import Fieldset from "~/components/ui/fieldset"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio, CardapioPizzaSlice } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import SelectPizzaAlTaglioCategory from "~/domain/cardapio-pizza-al-taglio/components/select-pizza-al-taglio-type/select-pizza-al-taglio-type"
import { PizzaSliceCategory } from "~/domain/pizza-al-taglio/pizza-al-taglio.model.server"
import { cn } from "~/lib/utils"
import { ok, serverError } from "~/utils/http-response.server"
import randomReactKey from "~/utils/random-react-key"
import tryit from "~/utils/try-it"

export async function loader({ request }: LoaderArgs) {

    const [err, records] = await tryit(cardapioPizzaAlTaglioEntity.findAll())

    if (err) {
        return serverError(err)
    }

    const publicCardapio = records.filter(r => r.public === true)[0]
    const privateCardapios = records.filter(r => r.public === false)

    return ok({
        publicCardapio,
        privateCardapios,
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

    if (_action === "cardapio-slice-update-toppings") {
        const sliceId = values["sliceId"] as string
        const toppings = values["sliceToppings"] as string

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceUpdateToppings(cardapioId, sliceId, toppings))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço atualizado")
    }

    if (_action === "cardapio-slice-update-quantity") {
        const sliceId = values["sliceId"] as string
        const quantity = values["sliceQuantity"] as string

        if (isNaN(Number(quantity))) {
            return serverError("Quantidade inválida")
        }

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceUpdateQuantity(cardapioId, sliceId, Number(quantity)))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço atualizado")
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


export default function CardapioPizzaAlTaglioIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const publicCardapio = loaderData?.payload?.publicCardapio as CardapioPizzaAlTaglio || undefined
    const privateCardapios = loaderData?.payload?.privateCardapios as CardapioPizzaAlTaglio[] || []

    const cardapios = [publicCardapio, ...privateCardapios]

    if (loaderData?.status >= 400) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
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

    const [showPrivateCardapio, setShowPrivateCardapio] = useState(false)



    return (
        <div className="flex flex-col mt-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-muted-foreground ">{`Lista do cardapios (${cardapios.length})`}</h3>
            </div>
            <div className="flex flex-col gap-8">
                {/* <Form method="post">

                </Form> */}

                {/* <div className="flex gap-4 ">
                    <PageNumber config={{
                        totalPages: loaderData?.payload.totalPages || 0,
                        defaultValue: 1,
                    }} />
                    <span className="text-slate-200">|</span>
                    <ItemsPerPage config={{
                        itemsPerPage: [10, 20, 40, 60],
                        defaultValue: 10,
                    }} />
                </div> */}

                {
                    publicCardapio !== undefined && (
                        <section className="flex flex-col ">
                            <h2 className="font-semibold text-muted-foreground">Cardapio Público</h2>
                            <Separator className="mb-4" />
                            <CardapioItem cardapio={publicCardapio} />
                        </section>
                    )
                }

                <section className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <h2 className="font-semibold text-muted-foreground">{`Cardapio Privados (${privateCardapios.length})`}</h2>
                        <div onClick={() => setShowPrivateCardapio(!showPrivateCardapio)} className="flex gap-2 items-center cursor-pointer">
                            {/* <span className="text-sm">{showPrivateCardapio ? "Esconder" : "Mostrar"}</span> */}
                            {showPrivateCardapio ? <Eye /> : <EyeOff />}

                        </div>
                    </div>
                    <Separator className="mb-4" />
                    {
                        showPrivateCardapio && (
                            <ul className="grid md:grid-cols-2 gap-4">
                                {
                                    privateCardapios.map(c => {
                                        return (
                                            <li key={randomReactKey()} className="flex items-center mb-4">
                                                <CardapioItem cardapio={c} />
                                            </li>
                                        )
                                    })
                                }
                            </ul>
                        )
                    }
                </section>



            </div>
        </div>

    )
}

interface CardapioItemProps {
    cardapio: CardapioPizzaAlTaglio
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

function CardapioItem({ cardapio }: CardapioItemProps) {
    const [showSlices, setShowSlices] = useState(false)
    const [showEdit, setShowEdit] = useState(false)

    const someIsNotAvailable = cardapio.slices.filter(s => s.isAvailable === false).length > 0

    const vegetarianAmount = cardapio.slices.filter(s => s.category === "vegetariana").length
    const meatAmount = cardapio.slices.filter(s => s.category === "carne").length
    const margheritaAmount = cardapio.slices.filter(s => s.category === "margherita").length

    return (
        // <Link to={`${cardapio.id}`} className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full h-[130px] hover:bg-slate-100 cursor-pointer`} >
        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full hover:border-muted-foreground`}>

            <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:grid md:grid-cols-2">
                        <div className="flex flex-col">
                            <h3 className="text-md font-semibold tracking-tight mb-1">{cardapio.name}</h3>
                            {/* @ts-ignore */}
                            <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">{`Criado no dia ${dayjs(cardapio!.createdAt).format("DD/MM/YYYY")}`}</h2>
                        </div>
                        <CopyButton
                            label="Copiar elenco para imprimir"
                            classNameLabel="text-sm md:text-xs"
                            classNameButton="px-4"
                            classNameContainer="md:justify-self-end"
                            textToCopy={pizzaSliceTextToPrint(cardapio)} />

                    </div>
                    <Separator />
                    <Form method="post" className="flex flex-col md:flex-row gap-4 ">
                        <input type="hidden" name="cardapioId" value={cardapio.id} />
                        {
                            cardapio.public === false && (
                                <div className="flex gap-2 items-center">
                                    {/* <span className="text-xs">Publica</span> */}
                                    {/* <Switch name="_action" value="cardapio-publish" /> */}
                                    <SubmitButton actionName="cardapio-publish"
                                        idleText="Publicar"
                                        loadingText="Publicando"
                                        icon={<BadgeCheck size={14} />} />
                                </div>
                            )
                        }
                        {
                            cardapio.public === true && (
                                <SubmitButton actionName="cardapio-mask"
                                    idleText="Ocultar"
                                    loadingText="Ocultando"
                                    icon={<BadgeX size={14} />}
                                    variant={"outline"}
                                />
                            )
                        }
                        {
                            someIsNotAvailable === true && (
                                <SubmitButton
                                    className="col-span-2"
                                    actionName="cardapio-slice-out-of-stock-recover-all"
                                    idleText="Restorar estoque"
                                    loadingText="Restorando..."
                                    icon={<Check />} />
                            )
                        }
                    </Form>
                    <Separator className="mb-6" />
                </div>
                <div className="flex flex-col gap-2">
                    <section className="flex justify-between items-center mb-4">
                        <div className="flex flex-col gap-2">
                            <span className="text-xs cursor-pointer hover:font-semibold text-muted-foreground" onClick={() => setShowSlices(!showSlices)}>
                                {showSlices === true ? "Esconder sabores" : "Mostrar sabores"}
                            </span>
                            <div className="flex gap-2 text-xs font-semibold">
                                <span>{`Vegetariano: ${vegetarianAmount}`}</span>
                                <span>{`Carne: ${meatAmount}`}</span>
                                <span>{`Margherita: ${margheritaAmount}`}</span>
                            </div>
                        </div>
                        {
                            showSlices === true && (

                                <div className="flex gap-1 items-center cursor-pointer hover:underline" onClick={() => setShowEdit(!showEdit)}>
                                    <span className="text-xs md:text-md">{showEdit === false ? "Abilitar alterações" : "Desabilitar alterações"}</span>
                                    <Edit size={14} />
                                </div>
                            )
                        }

                    </section>
                    <section className="flex flex-col gap-2">
                        {showEdit &&
                            <FormAddPizzaSliceIntoCardapio cardapio={cardapio} />
                        }

                        {
                            showSlices && (
                                <ul className="flex flex-col gap-1">
                                    {
                                        cardapio.slices.map((slice: CardapioPizzaSlice) => {
                                            return (
                                                <li key={slice.id} >
                                                    <Form method="post" className="grid grid-cols-6 text-xs md:text-base items-center mb-2">
                                                        <input type="hidden" name="cardapioId" value={cardapio.id} />
                                                        <input type="hidden" name="sliceId" value={slice.id} />
                                                        <TextareaItem type="text" rows={2}
                                                            className="border-none outline-none leading-tight col-span-3 text-sm" name="sliceToppings"
                                                            defaultValue={slice.toppings}
                                                            disabled={showEdit === false}
                                                        />
                                                        <InputItem type="text"
                                                            className="border-none outline-none text-sm max-w-[50px]" name="sliceQuantity"
                                                            defaultValue={slice.quantity}
                                                            disabled={showEdit === false}
                                                            autoComplete="yep"
                                                        />
                                                        {
                                                            showEdit === false && slice.isAvailable === true && (
                                                                <SubmitButton
                                                                    className="col-span-2"
                                                                    actionName="cardapio-slice-out-of-stock" idleText="Esgotar" loadingText="Esgotando..."
                                                                    variant={"outline"}
                                                                    icon={<X />} />
                                                            )
                                                        }
                                                        {
                                                            showEdit === false && slice.isAvailable === false && (
                                                                <SubmitButton
                                                                    className="col-span-2"
                                                                    actionName="cardapio-slice-out-of-stock-recover-slice" idleText="Restorar" loadingText="Restorando..."

                                                                    icon={<Check />} />
                                                            )
                                                        }
                                                        {
                                                            showEdit === true && (
                                                                <div className="flex gap-2 items-center justify-evenly col-span-2">
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

                                                                </div>

                                                            )
                                                        }

                                                    </Form>
                                                </li>
                                            )
                                        })
                                    }
                                </ul>
                            )
                        }
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

interface FormAddPizzaSliceIntoCardapioProps {
    cardapio: CardapioPizzaAlTaglio,
}


function FormAddPizzaSliceIntoCardapio({ cardapio }: FormAddPizzaSliceIntoCardapioProps) {
    return (
        <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold">Adicionar um novo sabor</h4>
            <Form method="post">
                <input type="hidden" name="cardapioId" value={cardapio.id} />
                <div className="flex flex-col gap-2">
                    <Fieldset>
                        <Textarea name="sliceToppings" placeholder="Ingredientes" required
                            className={
                                cn(
                                    `text-lg p-2 placeholder:text-gray-400`,
                                )
                            }
                        />
                    </Fieldset>

                    <Fieldset>
                        <SelectPizzaAlTaglioCategory name={"sliceCategory"} />
                    </Fieldset>

                    <Fieldset>
                        <InputItem type="text"
                            className="text-sm max-w-[150px]" name="sliceQuantity"
                            autoComplete="off"
                            placeholder="Quantidade"
                        />
                    </Fieldset>

                </div>
                <SubmitButton actionName="cardapio-slice-add"
                    idleText="Adicionar Sabor"
                    loadingText="Adicionando..."
                />

            </Form>
        </div>
    )
}