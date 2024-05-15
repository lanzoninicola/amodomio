import { ActionArgs, LoaderArgs } from "@remix-run/node"
import { Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Separator } from "~/components/ui/separator"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import CardapioPizzaAlTaglioItem from "~/domain/cardapio-pizza-al-taglio/components/cardapio-pizza-al-taglio-item/cardapio-pizza-al-taglio-item"
import { PizzaSliceCategory } from "~/domain/pizza-al-taglio/pizza-al-taglio.model.server"
import { cn } from "~/lib/utils"
import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import { lastUrlSegment } from "~/utils/url"

export async function loader({ request }: LoaderArgs) {

    const [err, records] = await tryit(cardapioPizzaAlTaglioEntity.findAll())

    if (err) {
        return serverError(err)
    }

    const publicCardapio = records.filter(r => r.public === true)[0]

    return ok({
        publicCardapio,
    })
}




export default function CardapioPizzaAlTaglioIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const publicCardapio = loaderData?.payload?.publicCardapio as CardapioPizzaAlTaglio || undefined

    if (loaderData?.status !== 200) {
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Oops</AlertTitle>
            <AlertDescription>
                {loaderData?.message}
            </AlertDescription>
        </Alert>
    }


    const [showPrivateCardapios, setShowPrivateCardapios] = useState(false)


    return (
        <div className="flex flex-col mt-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-muted-foreground ">Cardapios</h3>
                <span className="text-xs underline cursor-pointer"
                    onClick={() => setShowPrivateCardapios(!showPrivateCardapios)}>Visualizar os cardapios privados</span>
            </div>



            <CardapioPizzaAlTaglioTabs showPrivateCardapios={showPrivateCardapios} />

            <section className="flex flex-col">
                {
                    !publicCardapio ? (
                        <Alert className="w-max px-16">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="font-semibold">Posha!</AlertTitle>
                            <AlertDescription className="text-sm">Não foi publicado nenhum cardápio</AlertDescription>
                        </Alert>
                    ) : (
                        <CardapioPizzaAlTaglioItem cardapio={publicCardapio} />
                    )
                }
            </section>


        </div>

    )
}

interface CardapioPizzaAlTaglioTabsProps {
    showPrivateCardapios: boolean,
}

function CardapioPizzaAlTaglioTabs({ showPrivateCardapios }: CardapioPizzaAlTaglioTabsProps) {

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    const activeTabStyle = "bg-white text-black font-semibold rounded-md py-1"

    return (
        <div className="grid grid-cols-2 grid-rows-3 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-6 h-20
                                md:grid-cols-2 md:grid-rows-1 md:h-10
                            ">
            <Link to={``} className="w-full text-center">
                <div className={
                    cn(
                        activeTab === "cardapio-pizza-al-taglio" && activeTabStyle
                    )
                }>
                    <span className="text-sm">Publico</span>
                </div>
            </Link >

            {
                showPrivateCardapios && (
                    <Link to={`privado`} className="w-full text-center">
                        <div className={
                            cn(
                                activeTab === "privado" && activeTabStyle
                            )
                        }>
                            <span className="text-sm">Privado</span>
                        </div>
                    </Link>
                )
            }
        </div >
    )

}



