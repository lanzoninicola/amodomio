import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { AlertCircle, XCircle } from "lucide-react";
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
import { badRequest, ok, serverError } from "~/utils/http-response.server";
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

    console.log({ currentPromoCodeActive })

    if (!currentPromoCodeActive) {
        return badRequest("Codigo da promoção não definido")
    }



    return ok({ records: pizzas, promoCodes, currentPromoCodeActive });

};

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const promoCode = formData.get('promoCode');
    const recordId = formData.get('recordId');
    const pizzaName = formData.get('pizzaName');
    const pizzaIngredients = formData.get('pizzaIngredients');
    const pizzaValue = formData.get('pizzaValue');
    const pizzaPromoValue = formData.get('pizzaPromoValue');
    const vegetarian = formData.get('vegetarian');
    const visible = formData.get('public');
    const isSelected = formData.get('isSelected');


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

    if (_action === "add-pizza") {

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
            vegetarian: vegetarian === "on" ? true : false
        }

        const [err, record] = await tryit(promoPizzaPhotoEntity.create(newRecord))

        if (err) {
            return serverError(err)
        }
    }

    if (_action === "record-update") {

        const [errFounded, recordFounded] = await tryit(promoPizzaPhotoEntity.findById(recordId as string))

        if (errFounded) {
            return serverError(errFounded)
        }

        const nextRecord: PromoPizzaPhoto = {
            ...recordFounded,
            isSelected: recordFounded?.isSelected ? recordFounded.isSelected : false,
            pizza: {
                name: pizzaName as string,
                ingredients: pizzaIngredients as string,
                value: pizzaValue as string,
                promoValue: pizzaPromoValue as string,

            },
            promoCode: promoCode as string,
            public: visible === "on" ? true : false,
            vegetarian: vegetarian === "on" ? true : false
        }

        // @ts-ignore
        delete nextRecord._client
        // @ts-ignore
        delete nextRecord._collectionName

        // console.log({ nextRecord })

        const [err, record] = await tryit(promoPizzaPhotoEntity.update(recordId as string, nextRecord))

        if (err) {
            return serverError(err)
        }

        return ok("Record atualizado")
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
    const currentPromoCodeActive: PromoCode = loaderData.payload?.currentPromoCodeActive || undefined

    if (loaderData?.status !== 200) {
        return (
            <div className="grid place-items-center min-h-screen w-full">
                <div className="flex flex-col gap-4 rounded border p-6">
                    <div className="flex gap-2 text-red-500">
                        <AlertCircle />
                        <p className="font-semibold">{loaderData?.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">currentPromoCodeActive variable value: {!currentPromoCodeActive?.code ? "undefined" : currentPromoCodeActive?.code}</span>
                </div>
            </div>
        )
    }

    const [showFormAddPizza, setShowFormAddPizza] = useState(false)
    const [enableEdit, setEnableEdit] = useState(true)
    const [showFilters, setShowFilters] = useState(false)

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
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl md:text-2xl font-semibold ">{title}</h2>
                        <h3 className="text-xs">Código promocional configurado: {currentPromoCodeActive?.code}</h3>
                    </div>

                    <div className="flex gap-2">
                        <span className="text-sm underline cursor-pointer hover:font-semibold" onClick={() => setEnableEdit(!enableEdit)}>Abilitar alteraçoes</span>
                        <span className="text-sm underline cursor-pointer  hover:font-semibold" onClick={() => setShowFilters(!showFilters)}>Visualizar filtros</span>
                    </div>
                </div>
                {showFilters && <PizzasPromoFilters />}
                {
                    records.length === 0 && <span className="font-semibold">Nenhuma pizza encontrada</span>
                }
                <PizzaPromoList enableEdit={enableEdit} />
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
                <input type="hidden" name="promoCode" value={currentPromoCodeActive?.code} />
                <div className="flex gap-2 items-center mb-6">
                    <Label className="font-semibold">Codigo Promo</Label>
                    <InputItem
                        type="text" name="promoCode" placeholder="Codigo promo" required defaultValue={currentPromoCodeActive?.code}
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
                        Publico
                        <Switch id="public" name="public" defaultChecked={false} />
                    </Label>
                </Fieldset>

                <Fieldset>
                    <Label htmlFor="vegetarian" className="flex gap-2 items-center justify-end">
                        Vegetariano
                        <Switch id="vegetarian" name="vegetarian" defaultChecked={false} />
                    </Label>
                </Fieldset>

            </div>
            <SubmitButton actionName="add-pizza"
                idleText="Salvar"
                loadingText="Salvando..."
            />

        </Form>
    )
}

function PizzasPromoFilters() {
    const loaderData = useLoaderData<typeof loader>()
    const promoCodes: PromoCode[] = loaderData.payload?.promoCodes || []

    const [showPromoCodes, setShowPromoCodes] = useState(false)


    return (
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
    )
}

interface PizzaPromoListProps {
    enableEdit: boolean
}

function PizzaPromoList({ enableEdit }: PizzaPromoListProps) {
    const loaderData = useLoaderData<typeof loader>()
    const records = loaderData.payload?.records || []

    return (
        <ul className="flex flex-col gap-4" data-component="PizzaPromoList">
            {
                records.map((r: PromoPizzaPhoto) => {
                    return (
                        <li key={r.id} className={
                            cn(
                                "p-2 rounded-sm",
                            )
                        }>
                            <div className="flex flex-col gap-2">
                                {/* <!-- Badges and Pizza Name --> */}

                                <div className="flex gap-2 items-center mb-4">
                                    <span className={
                                        cn(
                                            "rounded-md  text-white text-xs font-semibold px-2 py-1",
                                            r.isSelected === false ? "bg-green-500" : "bg-red-500"
                                        )
                                    }>
                                        {r.isSelected === false ? "Disponivel" : "Escolhida"}
                                    </span>
                                    <span className={
                                        cn(
                                            "rounded-md  text-white text-xs font-semibold px-2 py-1",
                                            r.public === false ? "bg-red-500" : "bg-green-500"
                                        )
                                    }>
                                        {r.public === false ? "Uso interno" : "Para o cliente"}
                                    </span>
                                </div>

                                <Form method="post" className="mb-4">
                                    <input type="hidden" name="recordId" value={r.id} />
                                    <input type="hidden" name="promoCode" value={r.promoCode} />
                                    {/* <!-- Nome e ingredientes --> */}

                                    <div className="flex flex-col md:grid md:grid-cols-2 gap-4">

                                        <div className="flex flex-col mb-4">


                                            <Fieldset className="md:grid-cols-3">
                                                <Label>Nome</Label>
                                                <InputItem
                                                    type="text" name="pizzaName" defaultValue={r.pizza.name}
                                                    className="font-semibold col-span-2"
                                                />
                                            </Fieldset>

                                            {/* <!-- Pizza Ingredients --> */}

                                            <Fieldset className="md:grid-cols-3">
                                                <Label>Ingredientes</Label>
                                                <TextareaItem
                                                    type="text" name="pizzaIngredients" defaultValue={r.pizza.ingredients}
                                                    className="min-h-[100px] text-base col-span-2"
                                                />
                                            </Fieldset>


                                            {/* <!-- Valores --> */}

                                            <Fieldset className="md:grid-cols-3">
                                                <Label>Preço:</Label>
                                                <InputItem
                                                    type="text" name="pizzaValue" defaultValue={r.pizza.value}
                                                    className="text-sm col-span-2"
                                                />
                                            </Fieldset>

                                            <Fieldset className="md:grid-cols-3">
                                                <Label>Preço promocional:</Label>
                                                <InputItem
                                                    type="text" name="pizzaPromoValue" defaultValue={r.pizza.promoValue}
                                                    className="text-sm col-span-2"
                                                />
                                            </Fieldset>

                                            <Fieldset className="md:grid-cols-3">
                                                <Label htmlFor="vegetarian" className="flex gap-2 items-center">
                                                    <Switch id="vegetarian" name="vegetarian" defaultChecked={r.vegetarian} />
                                                    Vegetariana
                                                </Label>
                                            </Fieldset>


                                            <Fieldset className="md:grid-cols-2">
                                                <Label htmlFor="public" className="flex gap-2 items-center">
                                                    <Switch id="public" name="public" defaultChecked={r.public} />
                                                    Visível ao publico
                                                </Label>
                                            </Fieldset>

                                            {
                                                enableEdit && (
                                                    <div className="flex flex-col md:flex-row gap-4 items-center mt-4">
                                                        <SaveItemButton variant={"outline"} actionName="record-update" label="Salvar" className="w-full text-lg md:text-xs" />
                                                        <DeleteItemButton variant={"outline"} actionName="record-delete" disabled={r.isSelected} label="Deletar" className="w-full text-lg md:text-xs border-red-500" />
                                                    </div>
                                                )
                                            }

                                        </div>

                                        {r.isSelected && <FormPizzaClienteBounded record={r} />}
                                    </div>

                                </Form>


                            </div>
                            <Separator className="my-4" />
                        </li>


                    )
                })
            }
        </ul >
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

const printCupomMotoboy = (
    record: PromoPizzaPhoto
): string => {

    return `
PIZZA: ${record.pizza.name || ""}

===============

NOME: ${record.selectedBy?.name || ""}
TELEFONE: ${record.selectedBy?.phoneNumber || ""}

===============

ENDEREÇO:
${record.selectedBy?.endereço || ""}
${record.selectedBy?.bairro || ""}
${record.selectedBy?.cep || ""}

===============

VALOR: ${record.pizza.promoValue || ""}
`
}

const printCupomKitchen = (
    record: PromoPizzaPhoto
): string => {

    return `
PIZZA: ${record.pizza.name || ""}

===============

NOME: ${record.selectedBy?.name || ""}
TELEFONE: ${record.selectedBy?.phoneNumber || ""}

===============

VALOR: ${record.pizza.promoValue || ""}
`
}

interface FormPizzaClienteBoundedProps {
    record: PromoPizzaPhoto
}

function FormPizzaClienteBounded({ record }: FormPizzaClienteBoundedProps) {
    const loaderData = useLoaderData<typeof loader>()

    const currentPromoCodeActive: PromoCode = loaderData.payload?.currentPromoCodeActive || undefined
    const dateStringPT = getDateFromPromoCode(currentPromoCodeActive?.code)

    return (
        <div className="flex flex-col justify-between rounded-md bg-muted p-4">

            <div className="flex flex-col md:max-w-lg">

                <div className="flex flex-col mb-2 text-sm">
                    <div className="flex flex-col md:flex-row gap-4 mb-1">
                        <span className="font-semibold">{record.selectedBy?.name}</span>

                    </div>
                    <span>{record.selectedBy?.endereço}</span>
                    <span>{record.selectedBy?.bairro}</span>
                    <span>{record.selectedBy?.cep}</span>
                    <span>Tel: {record.selectedBy?.phoneNumber}</span>
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
                    <CopyButton
                        label="Mensagen de lembrete promo"
                        classNameContainer="w-full"
                        classNameLabel="text-sm md:text-xs"
                        classNameButton="w-full md:w-max md:px-4 py-1"
                        classNameIcon="text-white"
                        textToCopy={waMessageRemember(dateStringPT, {
                            endereço: record.selectedBy?.endereço,
                            bairro: record.selectedBy?.bairro,
                            cep: record.selectedBy?.cep,
                        })} />
                    <CopyButton
                        label="Mensagem pronta entrega"
                        classNameContainer="w-full"
                        classNameLabel="text-sm md:text-xs"
                        classNameButton="w-full md:w-max md:px-4 py-1 md:text-sm"
                        classNameIcon="text-white"
                        textToCopy={`Olá, a sua pizza *${record.pizza.name}* está a caminho para entrega. Obrigado.`} />
                </div>



                <Separator className="my-4" />

                <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
                    <CopyButton
                        label="Cupom Motoboy"
                        variant="outline"
                        classNameLabel="text-sm md:text-xs font-semibold"
                        classNameButton="px-4 w-full"
                        classNameContainer="w-full"

                        textToCopy={printCupomMotoboy(record)} />

                    <CopyButton
                        label="Cupom Cozinha"
                        variant="outline"
                        classNameLabel="text-sm md:text-xs font-semibold"
                        classNameButton="px-4 w-full"
                        classNameContainer="w-full"

                        textToCopy={printCupomKitchen(record)} />
                </div>

            </div>


            <Form method="post" className="w-full mt-6 md:mt-0" >
                <input type="hidden" name="recordId" value={record.id} />

                <SubmitButton actionName="record-detach-customer"
                    className="md:max-w-full text-red-500 border-red-500"
                    idleText="Svincular"
                    loadingText="Svinculando..."
                    variant={"outline"}

                />
            </Form >
        </div>

    )
}




