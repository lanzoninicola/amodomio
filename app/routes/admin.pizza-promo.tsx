import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import Fieldset from "~/components/ui/fieldset";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export const loader: LoaderFunction = async () => {
    const [err, records] = await tryit(promoPizzaPhotoEntity.findAll())

    const promoCode = process.env.PIZZA_PHOTOS_PROMO_CODE

    const recordsCurrentPromo = records?.filter(p => p.promoCode === promoCode)

    return ok({ records: recordsCurrentPromo });

};

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action } = Object.fromEntries(formData);

    const recordId = formData.get('recordId');

    if (_action === "record-detach-customer") {
        const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (err) {
            return serverError(err)
        }

        const [errUpdate, recordUpdate] = await tryit(promoPizzaPhotoEntity.update(recordId as string, {
            ...record,
            isSelected: false,
            selectedBy: null

        }))

        if (errUpdate) {
            return serverError("Erro ao salvar os dados do endereço. Por favor contate o (46) 99127-2525")
        }

        return ok("Atualizado com sucesso")
    }

    return null;
};

export default function PromoPizzaAdmin() {

    const loaderData = useLoaderData<typeof loader>()
    const records: PromoPizzaPhoto[] = [
        {
            "pizza": {
                "ingredients": "Molho de tomate, Muçarela de Bufala em bolinha",
                "name": "Margherita di napoli",
                "value": "89.90",
                "promoValue": "70.0"
            },
            "selectedBy": {
                "endereço": "Rua Prefeito Placido Machado",
                "bairro": "La Salle",
                "cep": "85505190",
                "name": "Nicola Lanzoni",
                "phoneNumber": "46991052049"
            },
            "isSelected": true,
            "promoCode": "20240305-pizza-photos",
            "id": "zbkTq25Y5aLgMet38PcU"
        },
        {
            "pizza": {
                "ingredients": "Molho de tomate, Muçarela,Bacon defumado,Provolone defumado",
                "name": "Affumicata",
                "value": "89.90",
                "promoValue": "70.0"
            },
            "selectedBy": null,
            "isSelected": false,
            "promoCode": "20240305-pizza-photos",
            "id": "zbkTq25Y5aLgdet38PcU"
        }
    ]

    // const records = loaderData.payload?.records || []


    const [showForm, setShowForm] = useState(false)



    return (
        <Container className="mt-16">

            <div className="flex flex-col mb-4">
                <p className="text-sm underline mb-4 cursor-pointer hover:font-semibold" onClick={() => setShowForm(!showForm)}>Adicionar pizza</p>
                {
                    showForm && (
                        <Form method="post">
                            <div className="flex flex-col gap-2">
                                <Fieldset>
                                    <InputItem type="text" name="promoCode" placeholder="Codigo promo" required />
                                </Fieldset>

                                <Fieldset>
                                    <InputItem type="text" name="pizzaName" placeholder="Nome pizza" required />
                                </Fieldset>
                                <Fieldset>
                                    <Textarea name="pizzaIngredients" placeholder="Ingredientes" required
                                        className={
                                            cn(
                                                `text-lg p-2 placeholder:text-gray-400`,
                                            )
                                        }
                                    />
                                </Fieldset>

                                <Fieldset>
                                    <InputItem type="text" name="value" placeholder="Valor" required />
                                </Fieldset>

                                <Fieldset>
                                    <InputItem type="text" name="promoValue" placeholder="Valor em Promoçao" />
                                </Fieldset>

                            </div>
                            <SubmitButton actionName="record-add-pizza"
                                idleText="Salvar"
                                loadingText="Salvando..."
                            />

                        </Form>
                    )
                }
            </div>


            <Separator className="mb-8" />

            <div className="flex flex-col">
                <h2 className="text-2xl font-semibold mb-6">Listas das pizzas</h2>
                <ul className="flex flex-col gap-6">
                    {
                        records.map((r: PromoPizzaPhoto) => {
                            return (
                                <>
                                    <li key={r.id} className={
                                        cn(
                                            "flex flex-col hover:bg-blue-50 p-2 rounded-sm",
                                        )
                                    }>
                                        <div className="flex justify-between items-center">
                                            <h2 className="text-xl font-semibold"><span>🍕 </span>{r.pizza.name}</h2>
                                            {
                                                r.isSelected && (
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2">

                                                            <SubmitButton actionName="record-detach-customer"
                                                                idleText="Svincular"
                                                                loadingText="Svinculando..."
                                                                variant={"outline"}

                                                            />
                                                            <SubmitButton actionName="record-attach-customer"
                                                                className="bg-brand-blue font-semibold"
                                                                idleText="Vincular"
                                                                loadingText="Vinculando..."

                                                            />
                                                        </div>
                                                    </Form>
                                                )
                                            }
                                        </div>
                                        {
                                            r.isSelected && (
                                                <div className="flex flex-col md:max-w-lg">
                                                    <div className="flex justify-between">
                                                        <span className="font-semibold text-brand-blue">{r.selectedBy?.name}</span>
                                                        <span className="font-semibold text-brand-blue">{r.selectedBy?.phoneNumber}</span>
                                                    </div>
                                                    <span className="text-brand-blue">{r.selectedBy?.endereço}</span>
                                                    <span className="text-brand-blue">{r.selectedBy?.bairro}</span>
                                                    <span className="text-brand-blue">{r.selectedBy?.cep}</span>
                                                </div>
                                            )
                                        }
                                    </li>

                                    <Separator />
                                </>
                            )
                        })
                    }
                </ul>
            </div>
        </Container>
    )

}