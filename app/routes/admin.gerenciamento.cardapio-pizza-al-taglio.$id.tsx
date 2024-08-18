import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { useActionData, useLoaderData } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import CardapioPizzaAlTaglioItem from "~/domain/cardapio-pizza-al-taglio/components/cardapio-pizza-al-taglio-item/cardapio-pizza-al-taglio-item"
import { PizzaSliceCategory } from "~/domain/pizza-al-taglio/pizza-al-taglio.model.server"
import { badRequest, ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"




export async function loader({ request, params }: LoaderFunctionArgs) {

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

export async function action({ request }: ActionFunctionArgs) {
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

        return redirect("/admin/cardapio-pizza-al-taglio")
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



    return <CardapioPizzaAlTaglioItem cardapio={cardapio} />
}

