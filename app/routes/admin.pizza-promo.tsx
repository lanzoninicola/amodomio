import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { XCircle } from "lucide-react";
import { CheckSquareIcon, MinusSquareIcon, PlusSquareIcon, X } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import InputItem from "~/components/primitives/form/input-item/input-item";
import TextareaItem from "~/components/primitives/form/textarea-item/textarea-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { DeleteItemButton } from "~/components/primitives/table-list";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { PromoCode, promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import { PromoPizzaPhoto } from "~/domain/promo-pizza-photos/promo-pizza-photos.model.server";
import { cn } from "~/lib/utils";
import getSearchParam from "~/utils/get-search-param";
import { ok, serverError } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import tryit from "~/utils/try-it";


export const loader: LoaderFunction = async ({ request, params }) => {
    const [err, records] = await tryit(promoPizzaPhotoEntity.findAll())

    const filter = getSearchParam({ request, paramName: "filter" })

    const promoCodes = promoPizzaPhotoEntity.getAllPromoCodes()
    const currentPromoCodeActive = promoPizzaPhotoEntity.getActivePromoCode()

    let pizzas: PromoPizzaPhoto[] = []

    if (records === undefined) {
        return
    }

    pizzas = records.filter(r => r.promoCode === currentPromoCodeActive?.code)

    if (filter !== null) {
        if (records === undefined) {
            return
        }

        if (filter === "all") {
            pizzas = records
        }


        const filterObj: { [key: string]: string } = jsonParse(filter)
        if (filterObj?.code) {
            if (records === undefined) {
                return
            }

            pizzas = records.filter(r => r.promoCode === filterObj.code)
        }


    }

    // if (filter === "active") {
    //     if (records === undefined) {
    //         return
    //     }
    //     pizzas = records.filter(r => r.promoCode === currentPromoCodeActive?.code)
    // }



    return ok({ records: pizzas, promoCodes, currentPromoCodeActive });

};

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action } = Object.fromEntries(formData);

    const promoCode = formData.get('promoCode');
    const recordId = formData.get('recordId');
    const pizzaName = formData.get('pizzaName');
    const pizzaIngredients = formData.get('pizzaIngredients');
    const pizzaValue = formData.get('pizzaValue');
    const pizzaPromoValue = formData.get('pizzaPromoValue');
    const visible = formData.get('public');

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
            promoCode: promoCode as string,
            selectedBy: null,
            public: visible === "on" ? true : false,
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

function getDateFromPromoCode(promoCode: string | undefined) {

    if (promoCode === undefined) {
        return ""
    }
    const dateStr = promoCode.substring(0, 8);
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const dateStringPT = `${day}/${month}/${year}`;

    return dateStringPT;
}

export default function PromoPizzaAdmin() {

    const loaderData = useLoaderData<typeof loader>()

    const records = loaderData.payload?.records || []
    const promoCodes: PromoCode[] = loaderData.payload?.promoCodes || []
    const currentPromoCodeActive: PromoCode = loaderData.payload?.currentPromoCodeActive || undefined
    const dateStringPT = getDateFromPromoCode(currentPromoCodeActive.code)

    const [showFormAddPizza, setShowFormAddPizza] = useState(false)
    const [enableEdit, setEnableEdit] = useState(false)

    const [showPromoCodes, setShowPromoCodes] = useState(false)

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status === 200) {
        toast({
            title: "OK",
            description: message,
        })
    }

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
        })
    }


    let title = `Listas das pizzas (${records.length})`

    return (
        <Container className="mt-16">

            <div className="flex flex-col mb-4">
                <div className="flex items-center gap-2 mb-4 cursor-pointer hover:font-semibold" onClick={() => setShowFormAddPizza(!showFormAddPizza)}>
                    <span className="text-sm underline">{
                        showFormAddPizza === false ? "Adicionar pizza" : "Fechar formulário"
                    }</span>
                    {showFormAddPizza === false ? <PlusSquareIcon /> : <MinusSquareIcon />}
                </div>

                {
                    showFormAddPizza && (
                        <FormAddPizzaSlice />
                    )
                }
            </div>


            <Separator className="mb-8" />

            <div className="flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl md:text-2xl font-semibold ">{title}</h2>
                        <h3 className="text-xs">Código promocional configurado: {currentPromoCodeActive.code}</h3>
                    </div>

                    <span className="text-sm underline cursor-pointer" onClick={() => setEnableEdit(!enableEdit)}>Abilitar alteraçoes</span>
                </div>
                <div className="mb-8 rounded-md p-4 border">
                    <div className="flex items-start justify-between">

                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2 items-center">
                                <span>Filtrar por: </span>
                                <ul className="flex gap-4">
                                    <li className={
                                        cn(
                                            "text-sm cursor-pointer rounded-md px-2 py-1 bg-muted-foreground text-white hover:underline hover:bg-muted hover:text-black",
                                        )
                                    }>
                                        <Link to={`?filter=all`}>
                                            Todas as pizzas das promos
                                        </Link>
                                    </li>
                                    <li className={
                                        cn(
                                            "text-sm cursor-pointer rounded-md px-2 py-1 bg-muted-foreground text-white hover:underline hover:bg-muted hover:text-black",
                                        )
                                    }>
                                        <Link to={`?filter=active`}>
                                            Atualmente Ativo
                                        </Link>

                                    </li>
                                    <li
                                        onClick={() => setShowPromoCodes(!showPromoCodes)}
                                        className={
                                            cn(
                                                "text-sm cursor-pointer rounded-md px-2 py-1 bg-muted-foreground text-white hover:underline hover:bg-muted hover:text-black",
                                            )
                                        }>
                                        Codigo Promo
                                    </li>

                                </ul>
                            </div>
                            {
                                showPromoCodes === true && (
                                    <ul className="mt-4 flex gap-2 text-sm">
                                        {
                                            promoCodes.map(p => {
                                                return (
                                                    <li key={p.code} >
                                                        <Link to={`?filter={"code": "${p.code}"}`} className={
                                                            cn("flex items-center gap-1 hover:underline ",
                                                            )}>
                                                            <span>{p.code}</span>
                                                        </Link>
                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                )
                            }
                        </div>
                        <Link to={``} className={
                            cn("flex items-center gap-1 hover:underline hover:font-semibold ",
                            )}>
                            <span className="text-sm">Cancelar Filtro </span>
                            <XCircle size={16} />
                        </Link>

                    </div>
                </div>
                {
                    records.length === 0 && <span className="font-semibold">Nenhuma pizza encontrada</span>
                }
                <ul className="flex flex-col gap-4">
                    {
                        records.map((r: PromoPizzaPhoto) => {
                            return (
                                <li key={r.id} className={
                                    cn(
                                        "p-2 rounded-sm",
                                    )
                                }>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-col md:flex-row justify-between items-center w-full">

                                            <div className="flex flex-col">
                                                {/* <!-- Nome e ingredientes --> */}
                                                <div className="flex flex-col">
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex items-center">
                                                                {/* <span>{r.isSelected === false ? "🍕" : <CheckSquareIcon />}</span> */}
                                                                <InputItem
                                                                    type="text" name="pizzaName" defaultValue={r.pizza.name}
                                                                    className="border-none outline-none font-semibold text-xl w-max"
                                                                />
                                                                <div className="flex gap-2 items-center">
                                                                    <span className={
                                                                        cn(
                                                                            "rounded-md  text-white text-xs font-semibold px-2 py-1",
                                                                            r.isSelected === false ? "bg-green-500" : "bg-red-500"
                                                                        )
                                                                    }>
                                                                        {r.isSelected === false ? "Disponivel" : "Escolhida"}
                                                                    </span>
                                                                    {/* <span className={
                                                                        cn(
                                                                            "rounded-md  text-white text-xs font-semibold px-2 py-1",
                                                                            r.public === false ? "bg-red-500" : "bg-green-500"
                                                                        )
                                                                    }>
                                                                        {r.public === false ? "Uso interno" : "Para o cliente"}
                                                                    </span> */}
                                                                </div>
                                                            </div>
                                                            {enableEdit && <SaveItemButton actionName="record-update-pizza-name" />}
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
                                                                    {enableEdit && <SaveItemButton actionName="record-update-pizza-ingredients" />}
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
                                                                {enableEdit && <SaveItemButton actionName="record-update-pizza-value" />}
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
                                                                {enableEdit && <SaveItemButton actionName="record-update-pizza-promo-value" />}
                                                            </div>
                                                        </div>
                                                    </Form>
                                                </div>
                                            </div>

                                            {
                                                r.isSelected === true && enableEdit && (
                                                    <Form method="post" className="w-full md:w-auto">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <div className="flex gap-2 w-full">

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
                                                !r.isSelected && enableEdit && (
                                                    <Form method="post">
                                                        <input type="hidden" name="recordId" value={r.id} />
                                                        <DeleteItemButton actionName="record-delete" />
                                                    </Form>
                                                )
                                            }
                                        </div>

                                        {/** Nome cliente */}
                                        {
                                            r.isSelected && (
                                                <div className="flex flex-col md:grid md:grid-cols-2">
                                                    <div className="flex flex-col mb-2">
                                                        <div className="flex flex-col md:flex-row gap-4 mb-1">
                                                            <span className="font-semibold text-brand-blue">{r.selectedBy?.name}</span>

                                                        </div>
                                                        <span className="text-brand-blue">{r.selectedBy?.endereço}</span>
                                                        <span className="text-brand-blue">{r.selectedBy?.bairro}</span>
                                                        <span className="text-brand-blue">{r.selectedBy?.cep}</span>
                                                        <span className="text-brand-blue">Tel: {r.selectedBy?.phoneNumber}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
                                                            <CopyButton
                                                                label="Mensagen de lembrete promo"
                                                                classNameLabel="text-sm md:text-xs"
                                                                classNameButton="w-full md:w-max md:px-4 py-1"
                                                                textToCopy={waMessageRemember(dateStringPT, {
                                                                    endereço: r.selectedBy?.endereço,
                                                                    bairro: r.selectedBy?.bairro,
                                                                    cep: r.selectedBy?.cep,
                                                                })} />
                                                            <CopyButton
                                                                label="Mensagem pronta entrega"
                                                                classNameLabel="text-sm md:text-xs"
                                                                classNameButton="w-full md:w-max md:px-4 py-1 md:text-sm"
                                                                textToCopy={`Olá, a sua pizza *${r.pizza.name}* está a caminho para entrega. Obrigado.`} />
                                                        </div>
                                                        <CopyButton
                                                            label="CUPOM MOTOBOY"
                                                            classNameLabel="text-sm md:text-xs font-semibold"
                                                            classNameButton="w-full md:w-max md:px-4 py-1 bg-brand-blue"
                                                            textToCopy={motoboyMessage(dateStringPT, {
                                                                nome: r.selectedBy?.name,
                                                                endereço: r.selectedBy?.endereço,
                                                                bairro: r.selectedBy?.bairro,
                                                                cep: r.selectedBy?.cep,
                                                                valor: r.pizza.value,
                                                            })} />
                                                    </div>

                                                </div>

                                            )
                                        }

                                    </div>
                                    <Separator className="my-2" />
                                </li>


                            )
                        })
                    }
                </ul >
            </div >
        </Container >
    )

}

function FormAddPizzaSlice() {

    const loaderData = useLoaderData<typeof loader>()
    const currentPromoCodeActive: PromoCode = loaderData.payload?.currentPromoCodeActive || undefined

    return (
        <Form method="post">
            <div className="flex flex-col gap-2">
                <input type="hidden" name="promoCode" value={currentPromoCodeActive.code} />
                <div className="flex gap-2 items-center mb-6">
                    <Label className="font-semibold">Codigo Promo</Label>
                    <InputItem
                        type="text" name="promoCode" placeholder="Codigo promo" required defaultValue={currentPromoCodeActive.code}
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

                <Fieldset>
                    <Label htmlFor="public" className="flex gap-2 items-center justify-end">
                        Visível
                        <Switch id="public" name="public" defaultChecked={false} />
                    </Label>
                </Fieldset>

            </div>
            <SubmitButton actionName="add-pizza-al-taglio"
                idleText="Salvar"
                loadingText="Salvando..."
            />

        </Form>
    )
}


const waMessageRemember = (
    date: string,
    { endereço, bairro, cep }: { endereço: string | undefined, bairro: string | undefined, cep: string | undefined }
): string => {

    return `Olá!\n\nHoje, ${date}, é o dia da nossa sessão de fotos de cardápio.\n
Se você confirmou, lembramos que sua pizza terá *20% de desconto*, a *entrega será gratuita*, e o envio será feito aproximadamente *entre 18:30 e 20:30* no endereço:\n
${endereço || ""}
${bairro || ""}
${cep || ""}

Obrigado,
Equipe, pizzaria "A Modo Mio"`
}

const motoboyMessage = (
    date: string,
    { nome, endereço, bairro, cep, valor }: { nome: string | undefined, endereço: string | undefined, bairro: string | undefined, cep: string | undefined, valor: string }
): string => {

    return `
NOME: ${nome || ""}

=========================

ENDEREÇO:
${endereço || ""}
${bairro || ""}
${cep || ""}

=========================

VALOR: ${valor || ""}
`
}




