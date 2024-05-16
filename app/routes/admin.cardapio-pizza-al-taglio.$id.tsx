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
import CardapioPizzaAlTaglioItem from "~/domain/cardapio-pizza-al-taglio/components/cardapio-pizza-al-taglio-item/cardapio-pizza-al-taglio-item"
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


    return <CardapioPizzaAlTaglioItem cardapio={cardapio} />
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
