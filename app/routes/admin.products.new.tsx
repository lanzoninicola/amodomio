import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import type { Product } from "~/domain/product/product.model.server";
import type { ProductTypeOption, ProductUnitOption } from "~/modules/products/product.constants";
import { createProduct, getProductCreatePageData } from "~/modules/products/product.service.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import type { Category } from "@prisma/client";


export async function loader({ request }: ActionFunctionArgs) {
    const payload = await getProductCreatePageData(request)

    return ok({
        products: payload.products,
        callbackUrl: payload.callbackUrl,
        categories: payload.categories,
        types: payload.productTypes,
        units: payload.productUnits,
    })
}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const callbackUrl = values?.callbackUrl as string

    if (_action === "product-create") {

        const purchaseUnit = values.purchaseUnit as any
        const consumptionUnit = values.consumptionUnit as any
        const purchaseToConsumptionFactor = Number(values.purchaseToConsumptionFactor || 1)
        const [err, data] = await tryit(createProduct({
            name: values.name as string,
            categoryId: values?.categoryId as string,
            measurement: {
                purchaseUnit,
                consumptionUnit,
                purchaseToConsumptionFactor,
            }
        }))

        if (err) {
            return serverError(err)
        }

        if (callbackUrl !== "") {
            return redirect(callbackUrl)
        }

        return redirect(`/admin/products/${data.id}/info`)
    }

    return null
}


export default function SingleProductNew() {

    const loaderData = useLoaderData<typeof loader>()
    const products: Product[] = loaderData?.payload.products || []
    const callbackUrl = loaderData?.payload.callbackUrl
    const categories: Category[] = loaderData?.payload.categories || []
    const types: ProductTypeOption[] = loaderData?.payload.types || []
    const units: ProductUnitOption[] = loaderData?.payload.units || []

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    const [searchTerm, setSearchTerm] = useState("")
    const productsFilteredBySearch = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <Container>
            <Card>
                <CardHeader>
                    <CardTitle>Novo Produto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <Form method="post"  >
                        <div className="flex flex-col">
                            <div className="flex gap-2">
                                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                                <Fieldset>
                                    <Label htmlFor="product-name">Nome</Label>
                                    <Input type="string" id="product-name" placeholder="Nome produto" name="name" required
                                        autoComplete="off"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const value = e.target.value
                                            setSearchTerm(value)
                                        }} />
                                </Fieldset>
                                <Fieldset>
                                    <div className="max-w-[180px]">
                                        <Label htmlFor="consumptionUnit">Unidade de consumo</Label>
                                        <Select name="consumptionUnit" required defaultValue="g">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecionar..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {units.map((unit) => (
                                                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </Fieldset>
                            </div>
                            {
                                (searchTerm.split("").length > 0) &&
                                productsFilteredBySearch.length > 0 &&
                                (
                                    <div className="flex flex-col gap-4 text-red-500">
                                        <span className="text-xs font-semibold">Produtos encontrados:</span>
                                        <ul className="flex gap-2 text-xs flex-wrap">
                                            {productsFilteredBySearch.map(p => <li key={p.id}>{p.name}</li>)}
                                        </ul>
                                    </div>
                                )
                            }
                        </div>

                        <Separator className="my-4" />

                        {/* Tipo de produto */}

                        <Fieldset>
                            <div className="flex justify-between items-start ">
                                <Label htmlFor="description" className="pt-2">Tipo</Label>
                                <div className="flex flex-col gap-2 w-[300px]">
                                    <Select name="type" required >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup >
                                                {types.map((type, idx) => {
                                                    return <SelectItem key={idx} value={type.value}>{type.label}</SelectItem>
                                                })}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 space-y-3">
                                        <div className="space-y-1">
                                            <p className="font-semibold text-slate-900">Sabor</p>
                                            <p>Produto final de cardápio (ex.: sabor de pizza). É o item que o cliente escolhe.</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-slate-900">Semi-acabado</p>
                                            <p>Base/subpreparo interno que vira componente de outros produtos (ex.: massa pré-preparada, molho base).</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-slate-900">Produzido</p>
                                            <p>Item transformado pela produção e usado na composição de receitas (não é item de compra direta).</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-slate-900">Simples</p>
                                            <p>Insumo básico, sem transformação (ex.: farinha, azeite, tomate).</p>
                                        </div>

                                        <div className="border-t pt-3 space-y-1">
                                            <p className="font-semibold text-slate-900">Como escolher o tipo?</p>
                                            <p>Se o cliente compra diretamente: <span className="font-semibold">Sabor</span></p>
                                            <p>Se é base para outra preparação: <span className="font-semibold">Semi-acabado</span></p>
                                            <p>Se foi produzido e entra em composições: <span className="font-semibold">Produzido</span></p>
                                            <p>Se é matéria-prima direta: <span className="font-semibold">Simples</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Fieldset>

                        {/* Categoria */}

                        <Fieldset>
                            <div className="flex justify-between items-start ">
                                <Label htmlFor="categoryId" className="pt-2">Categoria</Label>
                                <div className="flex flex-col gap-2 w-[300px]">
                                    <Select name="categoryId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup >
                                                {categories && categories.map((c, idx) => {
                                                    return <SelectItem key={idx} value={c?.id || ""}>{c.name}</SelectItem>
                                                })}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Fieldset>

                        {/* Unidades e conversão */}

                        <Fieldset>
                            <div className="flex justify-between items-start ">
                                <Label htmlFor="purchaseUnit" className="pt-2">Unidade de compra</Label>
                                <div className="flex flex-col gap-2 w-[300px]">
                                    <Select name="purchaseUnit" required defaultValue="un">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup >
                                                {units.map((unit) => {
                                                    return <SelectItem key={`purchase-${unit.value}`} value={unit.value}>{unit.label}</SelectItem>
                                                })}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Fieldset>

                        <Fieldset>
                            <div className="flex justify-between items-start ">
                                <Label htmlFor="purchaseToConsumptionFactor" className="pt-2">Fator compra → consumo</Label>
                                <div className="flex flex-col gap-2 w-[300px]">
                                    <Input
                                        id="purchaseToConsumptionFactor"
                                        name="purchaseToConsumptionFactor"
                                        type="number"
                                        min="0.000001"
                                        step="0.000001"
                                        defaultValue="1"
                                        required
                                    />
                                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                                        <p className="font-semibold text-slate-900">Como funciona</p>
                                        <p>Informe quantas unidades de <b>consumo</b> existem em 1 unidade de <b>compra</b>.</p>
                                        <p>Exemplo: Manjericão comprado por UN e consumido em KG. Se 1 UN = 0,08 KG, fator = <b>0.08</b>.</p>
                                        <p>Exemplo: Queijo comprado em KG e consumido em G. Se 1 KG = 1000 G, fator = <b>1000</b>.</p>
                                    </div>
                                </div>
                            </div>
                        </Fieldset>

                        <Separator className="my-4" />

                        <div className="flex gap-2">
                            <SubmitButton actionName="product-create" className="w-[150px] gap-2" />
                        </div>

                    </Form>
                </CardContent>
            </Card>
        </Container>
    )
}
