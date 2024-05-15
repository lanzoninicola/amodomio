import { LoaderArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { Separator } from "~/components/ui/separator"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import { serverError, badRequest, ok } from "~/utils/http-response.server"
import randomReactKey from "~/utils/random-react-key"
import tryit from "~/utils/try-it"
import CardapioPizzaAlTaglioItem from "~/domain/cardapio-pizza-al-taglio/components/cardapio-pizza-al-taglio-item/cardapio-pizza-al-taglio-item"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { AlertCircle } from "lucide-react"

export async function loader({ request }: LoaderArgs) {

    const [err, records] = await tryit(cardapioPizzaAlTaglioEntity.findAll())

    if (err) {
        return serverError(err)
    }

    const privateCardapios = records.filter(r => r.public === false) || []

    if (privateCardapios.length === 0) {
        return badRequest("Nenhum cardapio de pizza al taglio")
    }

    return ok({
        privateCardapios,
    })
}

export default function CardapioPizzaAlTaglioPrivado() {

    const loaderData = useLoaderData<typeof loader>()
    const privateCardapios = loaderData?.payload?.privateCardapios as CardapioPizzaAlTaglio[] || []


    if (loaderData?.status !== 200) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
    }

    return (
        <section className="flex flex-col gap-2 mt-8">
            <Alert className="px-16 mb-8 bg-red-500 text-white">
                <AlertCircle className="h-4 w-4 " color="white" />
                <AlertTitle className="font-semibold">Atenção!</AlertTitle>
                <AlertDescription className="text-sm">Esse é a lista dos cardápio antigos</AlertDescription>
            </Alert>
            <ul className="grid md:grid-cols-2 gap-4">
                {
                    privateCardapios.map(c => {
                        return (
                            <li key={randomReactKey()} className="flex items-center mb-4">
                                <CardapioPizzaAlTaglioItem cardapio={c} />
                            </li>
                        )
                    })
                }
            </ul>

        </section>
    )
}