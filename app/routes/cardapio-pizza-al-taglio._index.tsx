import { useLoaderData } from "@remix-run/react"
import { AlertCircle, Beef, LeafyGreen } from "lucide-react"
import React from "react"
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server"
import { CardapioPizzaSlice } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server"
import { cn } from "~/lib/utils"
import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"


export async function loader() {

    const [err, slices] = await tryit(cardapioPizzaAlTaglioEntity.findPublicCardapio())

    if (err) {
        return serverError(err)
    }

    return ok({
        slices
    })

}

export default function CardapioPizzaAlTaglioIndex() {

    const loaderData = useLoaderData<typeof loader>()
    const vegetarianSlices: CardapioPizzaSlice[] = loaderData.payload?.slices["vegetarian"]
    const meatSlices: CardapioPizzaSlice[] = loaderData.payload?.slices["meat"]
    const margheritaSlices: CardapioPizzaSlice[] = loaderData.payload?.slices["margherita"]

    const isSlicesNotAvailable = vegetarianSlices.length === 0 &&
        meatSlices.length === 0 &&
        margheritaSlices.length === 0

    if (isSlicesNotAvailable) {
        return (
            <div className="grid place-items-center min-h-[200px] md:min-h-[300px] ">
                <div className="bg-white rounded-lg shadow-xl p-4">
                    <div className="flex gap-2 items-center mb-4">
                        <AlertCircle />
                        <h1 className="font-semibold">Atenção</h1>
                    </div>
                    <p className="leading-snug">
                        O cardápio das pizzas al taglio ainda não está disponivel.
                        Por gentileza, aguarde.
                        <br />
                        <br />
                        <span className="font-semibold text-sm">Equipe A Modo Mio</span>

                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full">
            <div className="flex flex-col gap-4 mb-8">

                {
                    vegetarianSlices.length > 0 && (
                        <section className="mb-4 ">
                            <SectionTitle icon={<LeafyGreen />}>Vegetariano</SectionTitle>
                            {/* <RowTitle /> */}
                            <ul className="flex flex-col gap-4">
                                {vegetarianSlices.map((s: CardapioPizzaSlice) => {
                                    return <PizzaSliceRow key={s.id} slice={s} />
                                })}
                            </ul>
                        </section>
                    )
                }

                {
                    meatSlices.length > 0 && (
                        <section className="mb-4">
                            <SectionTitle icon={<Beef />}>Com Carne</SectionTitle>
                            {/* <RowTitle /> */}
                            <ul className="flex flex-col gap-4">
                                {meatSlices.map((s: CardapioPizzaSlice) => {
                                    return <PizzaSliceRow key={s.id} slice={s} />
                                })}
                            </ul>
                        </section>
                    )
                }

                {
                    margheritaSlices.length > 0 && (
                        <section className="mb-4">
                            <SectionTitle>Margherita</SectionTitle>
                            {/* <RowTitle /> */}
                            <ul className="flex flex-col gap-4">
                                {margheritaSlices.map((s: CardapioPizzaSlice) => {
                                    return <PizzaSliceRow key={s.id} slice={s} />
                                })}
                            </ul>
                        </section>
                    )
                }

            </div>
            {/* <div className="fixed top-[85%]">
                <WhatsAppButtonExtended label="Reserva o teu pedaços" message="Olá queria reservar os pedaços de pizzas que segue: [indica os sabores]" className="px-6" />
            </div> */}
        </div>
    )
}

interface SectionTitleProps {
    children: React.ReactNode
    icon?: React.ReactNode
}

function SectionTitle({ children, icon }: SectionTitleProps) {

    const titleStyle = "text-lg tracking-normal font-bold font-accent uppercase"

    if (icon) {
        return (
            <div className="flex gap-2 items-center mb-2">
                {icon}
                <h2 className={cn(titleStyle)}>{children}</h2>
            </div>

        )
    }

    return <h2 className={cn(titleStyle, "mb-2")}>{children}</h2>

}

function RowTitle() {
    return (
        <div className="grid grid-cols-6 items-start mb-1 text-xs font-semibold">
            <span className="leading-tight col-span-5">Sabores</span>
            <span className="text-end">Valor</span>
        </div>
    )
}

interface PizzaSliceRowProps {
    slice: CardapioPizzaSlice
}

// function PizzaSliceRow({ slice }: PizzaSliceRowProps) {

//     return (


//         <li className={
//             cn(
//                 "grid grid-cols-6 items-start mb-4 text-md",
//                 slice.isAvailable === false && "opacity-50"
//             )
//         }>
//             <span className={
//                 cn(
//                     "leading-tight col-span-5",
//                     slice.isAvailable === false && "line-through"
//                 )
//             }>{slice.toppings}</span>
//             <span className="text-end text-sm font-semibold">{slice.value}</span>
//         </li>
//     )
// }

function PizzaSliceRow({ slice }: PizzaSliceRowProps) {

    return (


        <li className={
            cn(
                "flex flex-col gap-4 p-4 rounded-md shadow-md shadow-slate-200 ",
                slice.isAvailable === false && "opacity-50"
            )
        }>
            <span className={
                cn(
                    "text-lg leading-5",
                    slice.isAvailable === false && "line-through"
                )
            }>{slice.toppings}</span>
            <span className="text-end text-sm font-semibold text-brand-blue">{slice.value}</span>
        </li>
    )
}