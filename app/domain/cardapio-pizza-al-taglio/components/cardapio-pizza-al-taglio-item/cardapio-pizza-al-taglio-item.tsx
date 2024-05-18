import { Form } from "@remix-run/react"
import { AlertCircle, BadgeCheck, BadgeX, Check, Edit, Plus, Save, X } from "lucide-react"
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
import { Label } from "@radix-ui/react-label"
import Fieldset from "~/components/ui/fieldset"
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert"
import { Input } from "~/components/ui/input"




interface CardapioPizzaAlTaglioItemProps {
    cardapio: CardapioPizzaAlTaglio
}


export default function CardapioPizzaAlTaglioItem({ cardapio }: CardapioPizzaAlTaglioItemProps) {
    const [showEdit, setShowEdit] = useState(false)
    const [showNewPizzaSliceForm, setShowNewPizzaSliceForm] = useState(false)

    if (!cardapio) {
        return (
            <Alert className="w-max px-16">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-semibold">Posha!</AlertTitle>
                <AlertDescription className="text-sm">Cardápio não encontrado</AlertDescription>
            </Alert>
        )
    }

    const someIsNotAvailable = cardapio.slices.filter(s => s.isAvailable === false).length > 0

    const vegetarianAmount = cardapio.slices.filter(s => s.category === "vegetariana").length
    const meatAmount = cardapio.slices.filter(s => s.category === "carne").length
    const margheritaAmount = cardapio.slices.filter(s => s.category === "margherita").length

    const [pizzaSlices, setPizzaSlices] = useState(cardapio?.slices || [])

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
                    <Separator />
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <p className="text-xs text-muted-foreground font-semibold">Vegetariano: {vegetarianAmount} - Carne: {meatAmount} - Margherita: {margheritaAmount}</p>
                        </div>
                        <Fieldset className="flex gap-4 items-center mb-0">
                            <Label htmlFor="searchPizzaSlice" className="text-xs text-muted-foreground">Pesquisar</Label>
                            <Input id="searchPizzaSlice" onChange={(e) => {
                                const value = e.target?.value

                                if (value === "") {
                                    setPizzaSlices(cardapio?.slices)
                                    return
                                }

                                const founded = cardapio?.slices.filter(ps => ps.toppings.toLowerCase().includes(value))

                                setPizzaSlices(founded)

                            }} />
                        </Fieldset>
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
                    <section className="flex flex-col gap-4">
                        {showNewPizzaSliceForm &&
                            <FormAddPizzaSliceIntoCardapio cardapio={cardapio} />
                        }


                        <ul className="flex flex-col md:grid md:grid-cols-2 gap-4">
                            {
                                pizzaSlices.map((slice: CardapioPizzaSlice) => {
                                    return (
                                        <li key={slice.id} onClick={() => setShowEdit(true)}>
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
                                                                    actionName="cardapio-slice-update" idleText="Salvar" loadingText="Salvando..."
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
                        <DeleteItemButton actionName="cardapio-delete" label="Deletar o cardápio" />
                    </div>
                </Form>
            </div>
        </div>
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

        text += `*Vegetariana*\n${vegetarianSlicesText.join("")}\n`
    }

    if (meatSlices.length > 0) {
        const meatSlicesText = meatSlices.map(s => {
            return `- ${s.toppings}\n`
        })
        text += `*Com carne*\n${meatSlicesText.join("")}\n`
    }

    if (margheritaSlices.length > 0) {
        const margheritaSlicesText = margheritaSlices.map(s => {
            return `- ${s.toppings}\n`
        })
        text += `*Margherita*\n${margheritaSlicesText.join("")}\n`
    }

    return text
}