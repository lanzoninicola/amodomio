import { ActionArgs, LoaderArgs } from "@remix-run/node"
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react"
import dayjs from "dayjs"
import { useState } from "react"

import ItemsPerPage from "~/components/pagination/items-per-page"
import PageNumber from "~/components/pagination/page-number"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { toast } from "~/components/ui/use-toast"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaAlTaglio, CardapioPizzaSlice } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import { PizzaSlice } from "~/domain/pizza-al-taglio/pizza-al-taglio.model.server"
import getSearchParam from "~/utils/get-search-param"
import { ok, serverError } from "~/utils/http-response.server"
import randomReactKey from "~/utils/random-react-key"
import tryit from "~/utils/try-it"

export async function loader({ request }: LoaderArgs) {

    const [err, records] = await tryit(cardapioPizzaAlTaglioEntity.findAll())

    console.log({ records })

    if (err) {
        return serverError(err)
    }

    return ok({
        records
    })
}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // if (_action === "cardapio-delete") {
    //     const cardapioId = values["cardapioId"] as string

    //     const [err, returnedData] = await queryIt(cardapioPizzaAlTaglioEntity.model.deleteOne({ _id: new ObjectId(cardapioId) }))

    //     // if (err) {
    //     //     return serverError(err)
    //     // }

    //     return ok("Registro apagado.")
    // }

    return null

}


export default function CardapioPizzaAlTaglioIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const cardapios = loaderData?.payload?.records as CardapioPizzaAlTaglio[] || []

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

                <ul className="grid grid-cols-2 gap-4">
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
    const [showSlices, setShowSlices] = useState(false)

    return (
        // <Link to={`${cardapio.id}`} className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full h-[130px] hover:bg-slate-100 cursor-pointer`} >
        <Form method="post" className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full hover:bg-slate-100`}>
            <input type="hidden" name="cardapioId" value={cardapio.id} />
            <div className="flex flex-col gap-4 justify-between">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h3 className="text-md font-semibold tracking-tight mb-1">{cardapio.name}</h3>
                        {/* @ts-ignore */}
                        <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">{`Criado no dia ${dayjs(cardapio!.createdAt).format("DD/MM/YYYY")}`}</h2>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="text-xs">Publica</span>
                        <Switch name="_action" value="cardapio-publish" />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-xs cursor-pointer hover:font-semibold text-muted-foreground" onClick={() => setShowSlices(!showSlices)}>
                        {showSlices ? "Esconder sabores" : "Mostrar sabores"}
                    </span>
                    {
                        showSlices && (
                            <ul className="flex flex-col gap-1">
                                {
                                    cardapio.slices.map((slice: CardapioPizzaSlice) => {
                                        return (
                                            <li key={slice.id} className="text-xs">{`${slice.toppings} (${slice.quantity})`}</li>
                                        )
                                    })
                                }
                            </ul>
                        )
                    }
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
        // </Link>
    )
}