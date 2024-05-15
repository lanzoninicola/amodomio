import { Form } from "@remix-run/react"
import { BadgeCheck, BadgeX, Check, Edit, X } from "lucide-react"
import { useState } from "react"
import CopyButton from "~/components/primitives/copy-button/copy-button"
import InputItem from "~/components/primitives/form/input-item/input-item"
import TextareaItem from "~/components/primitives/form/textarea-item/textarea-item"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { DeleteItemButton } from "~/components/primitives/table-list"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import { CardapioPizzaAlTaglio, CardapioPizzaSlice } from "../../cardapio-pizza-al-taglio.model.server"
import { Separator } from "~/components/ui/separator"
import FormAddPizzaSliceIntoCardapio from "../form-add-pizza-al-taglio-into-cardapio/form-add-pizza-al-taglio-into-cardapio"
import dayjs from "dayjs"




interface CardapioPizzaAlTaglioItemProps {
    cardapio: CardapioPizzaAlTaglio
}


export default function CardapioPizzaAlTaglioItem({ cardapio }: CardapioPizzaAlTaglioItemProps) {
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