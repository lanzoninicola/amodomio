import { ActionArgs, LoaderArgs } from "@remix-run/node"
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { ObjectId } from "mongodb"
import ItemsPerPage from "~/components/pagination/items-per-page"
import PageNumber from "~/components/pagination/page-number"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import queryIt from "~/lib/atlas-mongodb/query-it.server"
import getSearchParam from "~/utils/get-search-param"
import { ok, serverError } from "~/utils/http-response.server"
import randomReactKey from "~/utils/random-react-key"

export async function loader({ request }: LoaderArgs) {

    console.log("execution loader index...")

    let pageParamName = getSearchParam({ request, paramName: "page" })
    let itemsPerPageParamName = getSearchParam({ request, paramName: "itemsPerPage" })

    if (Number.isNaN(pageParamName)) pageParamName = String(1)
    if (Number.isNaN(itemsPerPageParamName)) itemsPerPageParamName = String(10)

    const [err, data] = await queryIt(cardapioPizzaAlTaglioEntity.findPaginated({
        pageNumber: Number(pageParamName) || 1,
        pageSize: Number(itemsPerPageParamName) || 10,
    }))

    console.log("execution loader index...", { err, data })

    if (err) {
        return serverError(err)
    }

    return ok({
        cardapios: data?.documents,
        totalPages: data?.totalPages
    })
}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "cardapio-delete") {
        const cardapioId = values["cardapioId"] as string

        const [err, returnedData] = await queryIt(cardapioPizzaAlTaglioEntity.model.deleteOne({ _id: new ObjectId(cardapioId) }))

        // if (err) {
        //     return serverError(err)
        // }

        return ok("Registro apagado.")
    }

    return null

}


export default function CardapioPizzaAlTaglioIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const cardapios = loaderData?.payload?.cardapios as CardapioPizzaAlTaglio[] || []

    if (loaderData?.status >= 400) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
    }

    return (
        <div className="flex flex-col mt-4">
            <h3 className="text-xl font-semibold text-muted-foreground mb-6">Lista do cardapios</h3>
            <div className="flex flex-col gap-4">
                {/* <Form method="post">

                </Form> */}

                <div className="flex gap-4 ">
                    <PageNumber config={{
                        totalPages: loaderData?.payload.totalPages || 0,
                        defaultValue: 1,
                    }} />
                    <span className="text-slate-200">|</span>
                    <ItemsPerPage config={{
                        itemsPerPage: [10, 20, 40, 60],
                        defaultValue: 10,
                    }} />
                </div>

                <Separator className="mb-4" />
                <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {
                        cardapios.map(c => {
                            return (
                                <li key={randomReactKey()} className="flex items-center mb-4">
                                    <CardapioItem cardapio={c} />
                                </li>
                            )
                        })
                    }
                </ul>

            </div>
        </div>

    )
}

interface CardapioItemProps {
    cardapio: CardapioPizzaAlTaglio
}


function CardapioItem({ cardapio }: CardapioItemProps) {
    return (
        <Link to={`${cardapio._id}`} className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full h-[130px] hover:bg-slate-100 cursor-pointer`} >
            <Form method="post" >
                <input type="hidden" name="cardapioId" value={cardapio._id as unknown as string} />
                <div className="flex flex-col gap-4 justify-between">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <h3 className="text-xs font-semibold tracking-tight mb-1">Cardápio do dia</h3>
                            <h2 className="text-lg font-semibold tracking-tight">{cardapio.publishedDate}</h2>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs mb-2">Publica</span>
                            <Switch name="_action" value="cardapio-publish" />
                        </div>
                    </div>
                    <div className="w-full flex justify-end">
                        <DeleteItemButton actionName="cardapio-delete" />
                    </div>
                    {/* <Badge className={
                            cn(
                                "w-max",
                                category.type === "menu" ? "bg-brand-green" : "bg-brand-blue",
                            )
                        }>{category.type}</Badge> */}

                </div>
            </Form>
        </Link>
    )
}