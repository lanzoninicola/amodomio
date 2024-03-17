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
import { pizzaSliceEntity } from "~/domain/pizza-al-taglio/pizza-al-taglio.entity.server";
import { PizzaSlice } from "~/domain/pizza-al-taglio/pizza-al-taglio.model.server";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import { ok, serverError } from "~/utils/http-response.server";

import tryit from "~/utils/try-it";


export const loader: LoaderFunction = async () => {
    const [err, records] = await tryit(pizzaSliceEntity.findAll())

    return ok({ records });

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

    if (_action === "record-add-pizza") {

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

    if (_action === "record-update-toppings") {

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

export default function PizzaSlicesAdmin() {

    const loaderData = useLoaderData<typeof loader>()

    const records: PizzaSlice[] = loaderData.payload?.records || []

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
                        <FormAddPizza />
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
                        records.map((r: PizzaSlice) => {
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
                                                        <div className="flex gap-2 items-start">
                                                            <TextareaItem
                                                                type="text" name="toppings" defaultValue={r.toppings}
                                                                className="border-none outline-none"
                                                            />
                                                            {showFormUpdate && <SaveItemButton actionName="record-update-toppings" />}
                                                        </div>
                                                    </Form>


                                                </div>



                                            </div>


                                        </div>

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

function FormAddPizza() {

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
            <SubmitButton actionName="record-add-pizza"
                idleText="Salvar"
                loadingText="Salvando..."
            />

        </Form>
    )
}

