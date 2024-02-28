import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import { locale } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import { Settings } from "lucide-react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";



export const loader: LoaderFunction = async () => {
    const [err, records] = await tryit(promoPizzaPhotoEntity.findAll())

    const promoCode = process.env.PIZZA_PHOTOS_PROMO_CODE
    const pizzasNumber = process.env.PIZZA_PHOTOS_PIZZAS_NUMBER

    const recordsCurrentPromo = records?.filter(p => p.promoCode === promoCode)

    return ok({ records: recordsCurrentPromo, pizzasNumber });

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
    const pizzasNumber = loaderData.payload?.pizzasNumber

    return (
        <>
            <div className="mb-8">
                <div className="mb-4">
                    <h1 className="text-xl font-bold">Promo "Fotos Cardápio"</h1>
                    <p className="tracking-tight">Escolha uma dessas <span>{pizzasNumber}</span> pizzas, aproveita de <span className="font-semibold text-brand-blue">20% de desconto, e a entrega é por nossa conta</span></p>
                </div>
                <DialogRules />
            </div>
            <div>
                <h2 className="text-lg font-bold mb-4">Pizzas</h2>
                <ul className="flex flex-col gap-6">
                    {
                        records.map((p: PromoPizzaPhoto) => {
                            return (

                                <li key={p.id} className={
                                    cn(

                                        p.isSelected && "opacity-50"
                                    )
                                }>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex flex-col">
                                            <h2 className="font-semibold">{p.pizza.name}</h2>
                                            <div className="flex gap-2 items-center mb-2">
                                                <span className="text-sm">Preço:</span>
                                                <span className="text-sm text-slate-400 line-through">R${p.pizza.value}</span>
                                                <span className="text-sm font-semibold">R${p.pizza.promoValue}</span>
                                            </div>
                                            <span className="text-sm tracking-tight">{p.pizza.ingredients}</span>
                                        </div>

                                        <Link to={p.isSelected === true ? `/pizza-promo` : `/pizza-promo/${p.id}`}>
                                            <Button className="bg-brand-blue font-semibold" disabled={p.isSelected === true}>{
                                                p.isSelected === true ? "Não disponivel" : "Selecionar"
                                            }</Button>
                                        </Link>
                                    </div>
                                    <Separator />
                                </li>

                            )
                        })
                    }
                </ul>
            </div >
        </>
    )
}


function DialogRules() {


    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex gap-2 items-center">
                    <Settings />
                    <span className="underline hover:font-semibold">Regulamento</span>
                </div>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Regulamento</DialogTitle>
                    {/* <DialogDescription>
                       <p></p>

                    </DialogDescription> */}
                </DialogHeader>

                <div className="flex flex-col gap-6">
                    <ul className="flex flex-col gap-2">
                        <li>- A promoção é válida apenas no dia determinado e comunicado através de mensagem pelo WhatsApp.</li>
                        <li>- Será disponibilizado um número limitado de pizzas.</li>
                        <li>- A pizza disponibilizada será de tamanho médio e limitada a apenas um sabor.</li>
                        <li>- Não será possível adicionar ou remover ingredientes.</li>
                    </ul>

                    <div className="flex flex-col">
                        <span className="font-semibold">Obrigado</span>
                        <span>Equipe A Modo Mio</span>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}