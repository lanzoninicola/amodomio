import { ActionFunction, LoaderFunctionArgs, LoaderFunction, redirect } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import { Card, CardHeader } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "~/components/ui/label";
import { toast } from "~/components/ui/use-toast";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhotoPizzaIncluded } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export const loader: LoaderFunction = async ({ request, params }: LoaderFunctionArgs) => {
    const recordId = params?.id

    if (!recordId) {
        return redirect("/pizza-promo")
    }

    const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId))

    if (err) {
        return redirect("/pizza-promo")
    }

    return ok({ id: recordId, pizzaSelected: record?.pizza });
};

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action } = Object.fromEntries(formData);

    const recordId = formData.get('recordId');
    const fullName = formData.get('fullName');
    const phoneNumber = formData.get('phoneNumber');
    const address = formData.get('address');
    const neighborhood = formData.get('neighborhood');
    const zipCode = formData.get('zipCode');
    const checkedTerms = formData.get('checkedTerms');


    if (_action === "pizza-promo-record-customer-info-save") {
        const [err, record] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (err) {
            return serverError("Erro generico. Por favor contate o (46) 99127-2525")
        }

        const [errUpdate, recordUpdate] = await tryit(promoPizzaPhotoEntity.update(recordId as string, {
            ...record,
            isSelected: true,
            selectedBy: {
                bairro: neighborhood as string,
                cep: zipCode as string,
                endereço: address as string,
                name: fullName as string,
                phoneNumber: phoneNumber as string
            },
            checkedTerms
        }))

        if (errUpdate) {
            return serverError("Erro ao salvar os dados do endereço. Por favor contate o (46) 99127-2525")
        }

        return redirect(`/pizza-promo/obrigado`)
    }

    return null;
};

export default function SinglePizzaPromo() {

    const loaderData = useLoaderData<typeof loader>()

    const pizzaSelected = loaderData.payload?.pizzaSelected;
    const recordId = loaderData.payload?.id;

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    const [termsChecked, setTermsChecked] = useState(true)

    return (
        <>
            <div className="mb-8">
                <h3 className="text-xl font-bold">Local de entrega</h3>
                <p className="tracking-tight mb-4">Por favor, informe-nos sobre o local de entrega. <span className="font-semibold">Lembre-se de que a entrega é por nossa conta</span></p>
                <div className="rounded-sm bg-blue-300/50 p-2">
                    <h4 className="text-sm font-semibold"> Pizza selecionada</h4>
                    <span className="text-sm tracking-tight ">{pizzaSelected.name}: {pizzaSelected.ingredients}</span>
                </div>
            </div>
            <div>

                <Form method="post" className="space-y-4">
                    <div className="mb-6">
                        <input type="text" className="hidden" name="recordId" defaultValue={recordId} />
                        <Fieldset>
                            <InputItem type="text" name="fullName" placeholder="Nome completo" required />
                        </Fieldset>
                        <Fieldset>
                            <InputItem type="text" name="phoneNumber" placeholder="Número de telefone com DDD" required />
                        </Fieldset>
                        <Fieldset>
                            <InputItem type="text" name="address" placeholder="Endereço completo" required />
                        </Fieldset>
                        <Fieldset>
                            <InputItem type="text" name="neighborhood" placeholder="Bairro" required />
                        </Fieldset>
                        <Fieldset>
                            <InputItem type="text" name="zipCode" placeholder="CEP" required />
                        </Fieldset>

                        <p className="text-sm text-gray-500">* Todos os campos são obrigatórios</p>
                    </div>
                    <div className="rounded bg-muted p-4">
                        <strong className="text-sm">Observação</strong>
                        <p className="text-sm">Não será seguida uma ordem específica de entrega durante a promoção. Portanto, é importante estar disponíveis para receber sua pizza em qualquer momento dentro do horário estabelecido para a promoção</p>
                    </div>
                    <Fieldset>
                        <div className="items-center flex space-x-2">
                            <Checkbox id="checked-terms" name="checked-terms" required
                                checked={termsChecked}
                                onCheckedChange={(checked) => {
                                    const isChecked = checked === true ? true : false

                                    setTermsChecked(isChecked)
                                }}
                            />
                            <Label
                                htmlFor="checked-terms"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 "
                            >
                                Eu lí o <Link to="/pizza-promo/regulamento" className="underline">regulamento</Link>
                            </Label>
                        </div>

                    </Fieldset>
                    <div className="flex flex-col gap-4">
                        <SubmitButton actionName="pizza-promo-record-customer-info-save" idleText="Confirmar" loadingText="Confirmando" className="bg-brand-blue" disabled={termsChecked === false} />
                        <Link to="/pizza-promo" className="border rounded-sm w-full text-center text-sm py-2 text-gray-700 border-brand-blue">Voltar</Link>
                    </div>
                </Form>
            </div>
        </>
    )
}
