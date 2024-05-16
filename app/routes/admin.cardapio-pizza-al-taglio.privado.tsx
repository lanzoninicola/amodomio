import { LoaderArgs } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
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
import dayjs from "dayjs"
import { useState } from "react"
import { Label } from "@radix-ui/react-label"
import Fieldset from "~/components/ui/fieldset"
import { Input } from "~/components/ui/input"
import cardapio from "./cardapio"

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

    const [cardapios, setCardapios] = useState(privateCardapios)

    return (
        <section className="flex flex-col gap-2 mt-8">
            <Alert className="px-16 mb-8 bg-red-500 text-white">
                <AlertCircle className="h-4 w-4 " color="white" />
                <AlertTitle className="font-semibold">Atenção!</AlertTitle>
                <AlertDescription className="text-sm">Esse é a lista dos cardápio antigos</AlertDescription>
            </Alert>

            {/*

                IT DOES NOT WORK
                <Separator />
            <Fieldset className="flex gap-4 items-center mb-0">
                <Label htmlFor="searchPizzaSlice" className="text-xs text-muted-foreground">Pesquisar</Label>
                <Input id="searchPizzaSlice"
                    className="w-full"
                    onChange={(e) => {
                        const value = e.target?.value

                        if (value === "") {
                            setCardapios(privateCardapios)
                            return
                        }

                        const founded = privateCardapios.filter(pc => {

                            const slice = pc?.slices.filter(ps => ps.toppings.toLowerCase().includes(value))
                            const records = slice.length > 0 ? [pc] : []

                            return records
                        })

                        console.log({ value, founded })

                        setCardapios(founded)
                    }} />
            </Fieldset>
            <Separator className="mb-6" /> */}
            <ul className="grid md:grid-cols-2 gap-4">
                {
                    cardapios.map(c => {
                        return (
                            <Link to={`/admin/cardapio-pizza-al-taglio/${c.id}?type=private`} key={randomReactKey()}>
                                <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full hover:border-muted-foreground`}>
                                    <div className="flex flex-col">
                                        <h3 className="text-sm font-semibold tracking-tight mb-1">{c.name}</h3>
                                        {/* @ts-ignore */}
                                        <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">{`Criado no dia ${dayjs(c!.createdAt).format("DD/MM/YYYY")}`}</h2>
                                    </div>

                                    <ul className="list-disc px-4">
                                        {
                                            c.slices.map(s => <li key={s.id} className="text-xs text-muted-foreground">{s.toppings}</li>)
                                        }
                                    </ul>

                                </div>
                            </Link>
                        )
                    })
                }
            </ul>

        </section>
    )
}