import { LoaderArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { ObjectId } from "mongodb"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import queryIt from "~/lib/atlas-mongodb/query-it.server"
import { ok, serverError } from "~/utils/http-response.server"


export async function loader({ request, params }: LoaderArgs) {

    const cardapioId = params?.id

    if (!cardapioId) {
        return serverError('Cardapio não encontrado')
    }

    const [err, cardapio] = await queryIt(cardapioPizzaAlTaglioEntity.model.findOne({ _id: { $eq: new ObjectId(cardapioId) } }))

    console.log({ err, cardapio })


    if (err) {
        return serverError(err)
    }

    return ok({ cardapio })

}

export default function SingleAdminCardapioPizzaAlTaglio() {
    const loaderData = useLoaderData<typeof loader>()
    const cardapio = loaderData?.payload.cardapio as CardapioPizzaAlTaglio

    console.log({ cardapio })


    return <div>SingleAdminCardapioPizzaAlTaglio</div>
}