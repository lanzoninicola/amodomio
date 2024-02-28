import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";



export const loader: LoaderFunction = async () => {
    const [err, records] = await tryit(promoPizzaPhotoEntity.findAll())

    const promoCode = process.env.PIZZA_PHOTOS_PROMO_CODE

    const recordsCurrentPromo = records?.filter(p => p.promoCode === promoCode)

    return ok({ records: recordsCurrentPromo });

};


export default function PizzaPromoIndex() {
    const loaderData = useLoaderData<typeof loader>()
    // const pizzas: PromoPizzaPhoto[] = [
    //     {
    //         "pizza": {
    //             "ingredients": "Molho de tomate, Muçarela de Bufala em bolinha",
    //             "name": "Margherita di napoli"
    //         },
    //         "selectedBy": {
    //             "endereço": "Rua Prefeito Placido Machado",
    //             "bairro": "La Salle",
    //             "cep": "85505190",
    //             "name": "Nicola Lanzoni",
    //             "phoneNumber": "46991052049"
    //         },
    //         "isSelected": false,
    //         "promoCode": "20240305-pizza-photos",
    //         "id": "zbkTq25Y5aLgMet38PcU"
    //     },
    //     {
    //         "pizza": {
    //             "ingredients": "Molho de tomate, Muçarela,Bacon defumado,Provolone defumado",
    //             "name": "Affumicata"
    //         },
    //         "selectedBy": null,
    //         "isSelected": false,
    //         "promoCode": "20240305-pizza-photos",
    //         "id": "zbkTq25Y5aLgdet38PcU"
    //     }
    // ]

    const records = loaderData.payload?.records || []

    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-bold">Pizzas</h1>
                <p className="tracking-tight">Escolha uma dessas 15 pizzas, aproveita de <span className="font-semibold text-brand-blue">20% de desconto, e a entrega é por nossa conta</span></p>
            </div>
            <ul className="flex flex-col gap-6">
                {
                    records.map((p: PromoPizzaPhoto) => {
                        return (
                            <>
                                <li key={p.id} className={
                                    cn(
                                        "flex justify-between items-center",
                                        p.isSelected && "opacity-50"
                                    )
                                }>
                                    <div className="flex flex-col">
                                        <h2 className="font-semibold">{p.pizza.name}</h2>
                                        <span className="text-sm tracking-tight">{p.pizza.ingredients}</span>
                                    </div>

                                    <Link to={p.isSelected === true ? `/pizza-promo` : `/pizza-promo/${p.id}`}>
                                        <Button className="bg-brand-blue font-semibold" disabled={p.isSelected === true}>{
                                            p.isSelected === true ? "Não disponivel" : "Selecionar"
                                        }</Button>
                                    </Link>
                                </li>
                                <Separator />
                            </>
                        )
                    })
                }
            </ul>
        </>
    )
}
