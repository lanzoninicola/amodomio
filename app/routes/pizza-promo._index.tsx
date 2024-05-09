import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { AlertCircle, ChevronRightSquareIcon, Settings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import PromoRules from "~/domain/promo-pizza-photos/components/promo-rules/promo-rules";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";



export const loader: LoaderFunction = async () => {
    const [err, records] = await tryit(promoPizzaPhotoEntity.findAll())

    const currentPromoCodeActive = promoPizzaPhotoEntity.getActivePromoCode()

    const recordsCurrentPromo = records?.filter(p => p.public === true && p.promoCode === currentPromoCodeActive?.code)

    return ok({ records: recordsCurrentPromo, pizzasNumber: recordsCurrentPromo?.length });

};


export default function PizzaPromoIndex() {
    const loaderData = useLoaderData<typeof loader>()


    const records = loaderData.payload?.records || []
    const pizzasNumber = loaderData.payload?.pizzasNumber

    if (pizzasNumber === 0) {
        return (
            <div className="grid place-items-center min-h-[200px] md:min-h-[300px] ">
                <div className="bg-white rounded-lg shadow-xl p-4 md:p-6">
                    <div className="flex gap-2 items-center mb-4">
                        <AlertCircle />
                        <h1 className="font-semibold">Atenção</h1>
                    </div>
                    <p className="leading-snug">
                        Atualmente, não há nenhuma promoção ativa.
                        <br />
                        <br />
                        <span className="font-semibold text-sm">Equipe A Modo Mio</span>

                    </p>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="mb-8">
                <div className="mb-4">
                    <h1 className="text-xl font-bold">Promo "Fotos Cardápio"</h1>
                    <p className="tracking-tight">Escolha uma dessas pizzas, aproveita de <span className="font-semibold text-brand-blue">20% de desconto, e a entrega é por nossa conta</span></p>
                </div>
                <DialogRules />
            </div>
            {
                pizzasNumber > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-4">Pizzas</h2>
                        <ul className="flex flex-col gap-6">
                            {
                                records.map((p: PromoPizzaPhoto) => {
                                    return (

                                        <li key={p.id} className={
                                            cn(
                                                "rounded border p-4",
                                                p.isSelected && "opacity-50"
                                            )
                                        }>
                                            <div className="flex flex-col gap-12 justify-between">
                                                <div className="flex flex-col gap-6">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {/* <ChevronRightSquareIcon size={16} /> */}
                                                            <h2 className="text-xl font-semibold text-brand-blue">{p.pizza.name}</h2>
                                                        </div>
                                                        <div className="flex gap-2 items-center mb-2">
                                                            <span className="text-sm">Preço:</span>
                                                            <span className="text-sm text-slate-400 line-through">R${p.pizza.value}</span>
                                                            <span className="text-sm font-semibold">R${p.pizza.promoValue}</span>
                                                        </div>

                                                        <div className={
                                                            cn(
                                                                "rounded-lg px-4 py-1 w-max text-xs",
                                                                p.isSelected && "opacity-50",
                                                                p.vegetarian === true ? "bg-green-200" : "bg-red-800"
                                                            )
                                                        }>
                                                            <span className={
                                                                p.vegetarian === true ? "bg-green-200" : "text-red-50"
                                                            }>
                                                                {p.vegetarian ? "Vegetariana" : "Carne ou peixe"}
                                                            </span>
                                                        </div>

                                                    </div>

                                                    <span className="tracking-tight">{p.pizza.ingredients}</span>
                                                </div>

                                                <Link to={p.isSelected === true ? `/pizza-promo` : `/pizza-promo/${p.id}`}>
                                                    <Button className="bg-brand-blue font-semibold w-full md:w-max" disabled={p.isSelected === true}>{
                                                        p.isSelected === true ? "Não disponivel" : "Selecionar"
                                                    }</Button>
                                                </Link>
                                            </div>

                                        </li>

                                    )
                                })
                            }
                        </ul>
                    </div >
                )
            }
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

                <PromoRules />
            </DialogContent>
        </Dialog>
    )
}