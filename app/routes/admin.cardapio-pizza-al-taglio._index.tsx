import { LoaderArgs } from "@remix-run/node"
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react"
import ItemsPerPage from "~/components/pagination/items-per-page"
import PageNumber from "~/components/pagination/page-number"
import SelectItemsPerPage from "~/components/pagination/select-items-per-page"
import SelectPageNumber from "~/components/pagination/select-page-number"
import { Separator } from "~/components/ui/separator"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import queryIt from "~/lib/atlas-mongodb/query-it.server"
import getSearchParam from "~/utils/get-search-param"
import { ok, serverError } from "~/utils/http-response.server"
import randomReactKey from "~/utils/random-react-key"

export async function loader({ request }: LoaderArgs) {

    let pageParamName = getSearchParam({ request, paramName: "page" })
    let itemsPerPageParamName = getSearchParam({ request, paramName: "itemsPerPage" })

    if (Number.isNaN(pageParamName)) pageParamName = String(1)
    if (Number.isNaN(itemsPerPageParamName)) itemsPerPageParamName = String(10)

    const [err, data] = await queryIt(cardapioPizzaAlTaglioEntity.findPaginated({
        pageNumber: Number(pageParamName) || 1,
        pageSize: Number(itemsPerPageParamName) || 10,
    }))

    if (err) {
        return serverError(err)
    }

    return ok({
        cardapios: data?.documents,
        totalPages: data?.totalPages
    })
}


export default function CardapioPizzaAlTaglioIndex() {

    const loaderData = useLoaderData<typeof loader>()
    const cardapios = loaderData.payload.cardapios as CardapioPizzaAlTaglio[]
    // const cardapios = [] as CardapioPizzaAlTaglio[]



    return (
        <div className="flex flex-col mt-4">
            <h3 className="text-xl font-semibold text-muted-foreground mb-6">Lista do cardapios</h3>
            <div className="flex flex-col gap-4">
                {/* <Form method="post">

                </Form> */}

                <div className="flex gap-4 ">
                    <PageNumber config={{
                        totalPages: loaderData.payload.totalPages,
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
    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")

    return (
        <Link to={`${cardapio._id}`} className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full h-[130px] hover:bg-slate-100 cursor-pointer`} >
            <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col">
                    <h3 className="text-xs font-semibold tracking-tight mb-1">Cardápio do dia</h3>
                    <h2 className="text-lg font-semibold tracking-tight">{cardapio.date}</h2>
                </div>
                {/* <Badge className={
                            cn(
                                "w-max",
                                category.type === "menu" ? "bg-brand-green" : "bg-brand-blue",
                            )
                        }>{category.type}</Badge> */}
            </div>
        </Link>
    )
}