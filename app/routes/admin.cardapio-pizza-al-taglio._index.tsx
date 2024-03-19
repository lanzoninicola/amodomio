import { ActionArgs, LoaderArgs } from "@remix-run/node"
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react"
import dayjs from "dayjs"
import { BadgeCheck, BadgeX, Check, Eye, EyeOff, RotateCcw, X } from "lucide-react"
import { useState } from "react"

import ItemsPerPage from "~/components/pagination/items-per-page"
import PageNumber from "~/components/pagination/page-number"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
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

    if (err) {
        return serverError(err)
    }

    const publicCardapio = records.filter(r => r.public === true)[0]
    const privateCardapios = records.filter(r => r.public === false)

    return ok({
        publicCardapio,
        privateCardapios,
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

        console.log({ err, returnedData })

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

    if (_action === "cardapio-slice-out-of-stock") {
        const sliceId = values["sliceId"] as string

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceOutOfStock(cardapioId, sliceId))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço esgotado")
    }

    if (_action === "cardapio-slice-out-of-stock-recover") {
        const sliceId = values["sliceId"] as string

        const [err, returnedData] = await tryit(cardapioPizzaAlTaglioEntity.sliceOutOfStockRecover(cardapioId, sliceId))

        if (err) {
            return serverError(err)
        }

        return ok("Pedaço esgotado")
    }


    return null

}


export default function CardapioPizzaAlTaglioIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const publicCardapio = loaderData?.payload?.publicCardapio as CardapioPizzaAlTaglio || undefined
    const privateCardapios = loaderData?.payload?.privateCardapios as CardapioPizzaAlTaglio[] || []

    const cardapios = [publicCardapio, ...privateCardapios]

    if (loaderData?.status >= 400) {
        toast({
            title: "Erro",
            description: loaderData?.message,
        })
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

    const [showPrivateCardapio, setShowPrivateCardapio] = useState(false)



    return (
        <div className="flex flex-col mt-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-muted-foreground ">{`Lista do cardapios (${cardapios.length})`}</h3>
            </div>
            <div className="flex flex-col gap-8">
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

                {
                    publicCardapio !== undefined && (
                        <section className="flex flex-col ">
                            <h2 className="font-semibold text-muted-foreground">Cardapio Público</h2>
                            <Separator className="mb-4" />
                            <CardapioItem cardapio={publicCardapio} />
                        </section>
                    )
                }

                <section className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <h2 className="font-semibold text-muted-foreground">{`Cardapio Privados (${privateCardapios.length})`}</h2>
                        <div onClick={() => setShowPrivateCardapio(!showPrivateCardapio)} className="flex gap-2 items-center cursor-pointer">
                            {/* <span className="text-sm">{showPrivateCardapio ? "Esconder" : "Mostrar"}</span> */}
                            {showPrivateCardapio ? <Eye /> : <EyeOff />}

                        </div>
                    </div>
                    <Separator className="mb-4" />
                    {
                        showPrivateCardapio && (
                            <ul className="grid md:grid-cols-2 gap-4">
                                {
                                    privateCardapios.map(c => {
                                        return (
                                            <li key={randomReactKey()} className="flex items-center mb-4">
                                                <CardapioItem cardapio={c} />
                                            </li>
                                        )
                                    })
                                }
                            </ul>
                        )
                    }
                </section>



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
        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full hover:border-muted-foreground`}>

            <div className="flex flex-col gap-4 justify-between">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-0">
                    <div className="flex flex-col">
                        <h3 className="text-md font-semibold tracking-tight mb-1">{cardapio.name}</h3>
                        {/* @ts-ignore */}
                        <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">{`Criado no dia ${dayjs(cardapio!.createdAt).format("DD/MM/YYYY")}`}</h2>
                    </div>
                    {
                        cardapio.public === false && (
                            <div className="flex gap-2 items-center">
                                {/* <span className="text-xs">Publica</span> */}
                                {/* <Switch name="_action" value="cardapio-publish" /> */}
                                <SubmitButton actionName="cardapio-publish" idleText="Publicar" loadingText="Publicando" icon={<BadgeCheck size={14} />} />
                            </div>
                        )
                    }
                    {
                        cardapio.public === true && (
                            <SubmitButton actionName="cardapio-mask" idleText="Ocultar" loadingText="Ocultando" icon={<BadgeX size={14} />} variant={"outline"} />
                        )
                    }
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-xs cursor-pointer hover:font-semibold text-muted-foreground" onClick={() => setShowSlices(!showSlices)}>
                        {showSlices ? "Esconder sabores" : "Mostrar sabores"}
                    </span>
                    {
                        showSlices === false && (
                            <ul className="flex flex-col gap-1">
                                {
                                    cardapio.slices.map((slice: CardapioPizzaSlice) => {
                                        return (
                                            <li key={slice.id} >
                                                <Form method="post" className="grid grid-cols-6 text-xs md:text-base items-center">
                                                    <input type="hidden" name="cardapioId" value={cardapio.id} />
                                                    <input type="hidden" name="sliceId" value={slice.id} />
                                                    <span className="leading-tight col-span-3">{slice.toppings}</span>
                                                    <span className="text-center">{slice.quantity}</span>
                                                    {
                                                        slice.isAvailable === true && (
                                                            <SubmitButton
                                                                className="col-span-2"
                                                                actionName="cardapio-slice-out-of-stock" idleText="Esgotar" loadingText="Esgotando..."
                                                                variant={"outline"}
                                                                icon={<X />} />
                                                        )
                                                    }
                                                    {
                                                        slice.isAvailable === false && (
                                                            <SubmitButton
                                                                className="col-span-2"
                                                                actionName="cardapio-slice-out-of-stock-recover" idleText="Recuperar" loadingText="Recuperando..."

                                                                icon={<Check />} />
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
                </div>
                <Form method="post">
                    <input type="hidden" name="cardapioId" value={cardapio.id} />
                    <div className="w-full flex justify-end">
                        <DeleteItemButton actionName="cardapio-delete" />
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