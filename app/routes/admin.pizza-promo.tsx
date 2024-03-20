import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { CheckSquareIcon, MinusSquareIcon, PlusSquareIcon } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import InputItem from "~/components/primitives/form/input-item/input-item";
import TextareaItem from "~/components/primitives/form/textarea-item/textarea-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { DeleteItemButton } from "~/components/primitives/table-list";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export const loader: LoaderFunction = async () => {
    const [err, records] = await tryit(promoPizzaPhotoEntity.findAll())

    const promoCode = process.env.PIZZA_PHOTOS_PROMO_CODE

    const recordsCurrentPromo = records?.filter(p => p.promoCode === promoCode)

    return ok({ records: recordsCurrentPromo, promoCode });

};

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action } = Object.fromEntries(formData);

    const recordId = formData.get('recordId');
    const pizzaName = formData.get('pizzaName');
    const pizzaIngredients = formData.get('pizzaIngredients');
    const pizzaValue = formData.get('pizzaValue');
    const pizzaPromoValue = formData.get('pizzaPromoValue');

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

    if (_action === "add-pizza-al-taglio") {

        const newRecord: PromoPizzaPhoto = {
            isSelected: false,
            pizza: {
                name: pizzaName as string,
                ingredients: pizzaIngredients as string,
                value: pizzaValue as string,
                promoValue: pizzaPromoValue as string,

            },
            promoCode: process.env.PIZZA_PHOTOS_PROMO_CODE as string,
            selectedBy: null,
        }

        const [err, record] = await tryit(promoPizzaPhotoEntity.create(newRecord))

        if (err) {
            return serverError(err)
        }
    }

    if (_action === "record-update-pizza-name") {

        const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (err) {
            return serverError(err)
        }

        const [errUpdate, recordUpdate] = await tryit(promoPizzaPhotoEntity.update(recordId as string, {
            ...record,
            pizza: {
                ...record?.pizza,
                name: pizzaName as string,

            }
        }))

        if (errUpdate) {
            return serverError("Erro ao salvar os dados da pizza. Por favor contate o (46) 99127-2525")
        }

        return ok("Nome pizza atualizado com successo")
    }

    if (_action === "record-update-pizza-ingredients") {

        const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (err) {
            return serverError(err)
        }

        const [errUpdate, recordUpdate] = await tryit(promoPizzaPhotoEntity.update(recordId as string, {
            ...record,
            pizza: {
                ...record?.pizza,
                ingredients: pizzaIngredients as string,

            }
        }))

        if (errUpdate) {
            return serverError("Erro ao salvar os dados da pizza. Por favor contate o (46) 99127-2525")
        }

        return ok("Ingredientes atualizados com sucesso")
    }

    if (_action === "record-update-pizza-value") {

        const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (err) {
            return serverError(err)
        }

        const [errUpdate, recordUpdate] = await tryit(promoPizzaPhotoEntity.update(recordId as string, {
            ...record,
            pizza: {
                ...record?.pizza,
                value: pizzaValue as string,
            }
        }))

        if (errUpdate) {
            return serverError("Erro ao salvar os dados da pizza. Por favor contate o (46) 99127-2525")
        }

        return ok("Valor atualizado com sucesso")
    }

    if (_action === "record-update-pizza-promo-value") {

        const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (err) {
            return serverError(err)
        }

        const [errUpdate, recordUpdate] = await tryit(promoPizzaPhotoEntity.update(recordId as string, {
            ...record,
            pizza: {
                ...record?.pizza,
                promoValue: pizzaPromoValue as string,
            }
        }))

        if (errUpdate) {
            return serverError("Erro ao salvar os dados da pizza. Por favor contate o (46) 99127-2525")
        }

        return ok("Valor promocional atualizado com sucesso")
    }

    if (_action === "record-delete") {
        const [err, record] = await tryit(promoPizzaPhotoEntity.delete(recordId as string))

        if (err) {
            return serverError(err)
        }

        return ok("Record apagado")
    }

    return null;
};

export default function PromoPizzaAdmin() {

    const loaderData = useLoaderData<typeof loader>()
    // const records: PromoPizzaPhoto[] = [
    //     {
    //         "pizza": {
    //             "ingredients": "Molho de tomate, Muçarela de Bufala em bolinha",
    //             "name": "Margherita di napoli",
    //             "value": "89.90",
    //             "promoValue": "70.0"
    //         },
    //         "selectedBy": {
    //             "endereço": "Rua Prefeito Placido Machado",
    //             "bairro": "La Salle",
    //             "cep": "85505190",
    //             "name": "Nicola Lanzoni",
    //             "phoneNumber": "46991052049"
    //         },
    //         "isSelected": true,
    //         "promoCode": "20240305-pizza-photos",
    //         "id": "zbkTq25Y5aLgMet38PcU"
    //     },
    //     {
    //         "pizza": {
    //             "ingredients": "Molho de tomate, Muçarela,Bacon defumado,Provolone defumado",
    //             "name": "Affumicata",
    //             "value": "89.90",
    //             "promoValue": "70.0"
    //         },
    //         "selectedBy": null,
    //         "isSelected": false,
    //         "promoCode": "20240305-pizza-photos",
    //         "id": "zbkTq25Y5aLgdet38PcU"
    //     }
    // ]

    const records = loaderData.payload?.records || []

    const [showForm, setShowForm] = useState(false)
    const [showFormUpdate, setShowFormUpdate] = useState(false)

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status === 200) {
        toast({
            title: "OK",
            description: message,
        })
    }

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }


    return (
        <Container className="mt-16">

            <div className="flex flex-col mb-4">
                <div className="flex items-center gap-2 mb-4 cursor-pointer hover:font-semibold" onClick={() => setShowForm(!showForm)}>
                    <span className="text-sm underline">{
                        showForm === false ? "Adicionar pizza" : "Fechar formulário"
                    }</span>
                    {showForm === false ? <PlusSquareIcon /> : <MinusSquareIcon />}
                </div>

                {
                    showForm && (
                        <FormAddPizzaSlice />
                    )
                }
            </div>


            <Separator className="mb-8" />

            <div className="flex flex-col">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-semibold mb-6">{`Listas das pizzas (${records.length})`}</h2>
                    <span className="text-sm underline cursor-pointer" onClick={() => setShowFormUpdate(!showFormUpdate)}>Abilitar alteraçoes</span>
                </div>
                <ul className="flex flex-col">
                    {
                        records.map((r: PromoPizzaPhoto) => {
                            return (
                                <li key={r.id} className={
                                    cn(
                                        "p-2 rounded-sm",
                                    )
                                }>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center">

                                            <div className="flex flex-col">

                                                {/* <!-- Nome e ingredientes --> */}

                                                <div className="flex flex-col">
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex items-center">
                                                                <span>{r.isSelected === false ? "🍕" : <CheckSquareIcon />}</span>
                                                                <InputItem
                                                                    type="text" name="pizzaName" defaultValue={r.pizza.name}
                                                                    className="border-none outline-none font-semibold text-xl w-max"
                                                                />
                                                            </div>
                                                            {showFormUpdate && <SaveItemButton actionName="record-update-pizza-name" />}
                                                        </div>
                                                    </Form>

                                                    {
                                                        r.isSelected === false && (
                                                            <Form method="post">
                                                                <input type="hidden" name="recordId" value={r.id} />
                                                                <div className="flex gap-2 items-start">
                                                                    <TextareaItem
                                                                        type="text" name="pizzaIngredients" defaultValue={r.pizza.ingredients}
                                                                        className="border-none outline-none"
                                                                    />
                                                                    {showFormUpdate && <SaveItemButton actionName="record-update-pizza-ingredients" />}
                                                                </div>
                                                            </Form>
                                                        )
                                                    }

                                                </div>

                                                {/* <!-- Valores --> */}
                                                <div className="flex gap-2 items-center">
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex items-center">
                                                                <span className="text-sm">Preço: </span>
                                                                <InputItem
                                                                    type="text" name="pizzaValue" defaultValue={r.pizza.value}
                                                                    className="border-none outline-none text-sm w-[75px]"
                                                                />
                                                                {showFormUpdate && <SaveItemButton actionName="record-update-pizza-value" />}
                                                            </div>
                                                        </div>
                                                    </Form>
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex items-center">
                                                                <span className="text-sm">Preço promocional: </span>
                                                                <InputItem
                                                                    type="text" name="pizzaPromoValue" defaultValue={r.pizza.promoValue}
                                                                    className="border-none outline-none text-sm w-[75px]"
                                                                />
                                                                {showFormUpdate && <SaveItemButton actionName="record-update-pizza-promo-value" />}
                                                            </div>
                                                        </div>
                                                    </Form>
                                                </div>



                                            </div>

                                            {
                                                r.isSelected === true && (
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2">

                                                            <SubmitButton actionName="record-detach-customer"
                                                                idleText="Svincular"
                                                                loadingText="Svinculando..."
                                                                variant={"outline"}

                                                            />
                                                            {/* <SubmitButton actionName="record-attach-customer"
                                                                className="bg-brand-blue font-semibold"
                                                                idleText="Vincular"
                                                                loadingText="Vinculando..."

                                                            /> */}
                                                        </div>
                                                    </Form>
                                                )
                                            }
                                            {
                                                !r.isSelected && (
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <DeleteItemButton actionName="record-delete" />
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

                                    </div>
                                    <Separator className="my-2" />
                                </li>


                            )
                        })
                    }
                </ul>
            </div>
        </Container>
    )

}

function FormAddPizzaSlice() {

    const loaderData = useLoaderData<typeof loader>()
    const promoCode = loaderData.payload?.promoCode

    return (
        <Form method="post">
            <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center mb-6">
                    <Label className="font-semibold">Codigo Promo</Label>
                    <InputItem
                        type="text" name="promoCode" placeholder="Codigo promo" required defaultValue={promoCode}
                        className="border-none outline-none"
                    />
                </div>

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
                    <InputItem type="text" name="pizzaValue" placeholder="Valor" required />
                </Fieldset>

                <Fieldset>
                    <InputItem type="text" name="pizzaPromoValue" placeholder="Valor em Promoçao" />
                </Fieldset>

            </div>
            <SubmitButton actionName="add-pizza-al-taglio"
                idleText="Salvar"
                loadingText="Salvando..."
            />

        </Form>
    )
}

