import { Form, Link, useActionData, useOutletContext } from "@remix-run/react";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { Textarea } from "~/components/ui/textarea";
import { redirect, type ActionArgs } from "@remix-run/node";
import errorMessage from "~/utils/error-message";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import { type ProductOutletContext } from "./admin.products.$id";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { type Product, type ProductType } from "~/domain/product/product.model.server";
import { productEntity } from "~/domain/product/product.entity";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import { Category } from "~/domain/category/category.model.server";
import { toast } from "~/components/ui/use-toast";


export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "product-info-update") {

        const [err, data] = await tryit(productEntity.update(values.productId as string, {
            "info.productId": values.productId as string,
            "info.type": values.type as ProductType,
            "info.description": values.description as string,
            "info.category": jsonParse(values.category) as Category || null
        }))

        if (err) {
            return badRequest(err)
        }

        return ok({ message: "Informaçẽs do produto atualizados com sucesso" })
    }

    if (_action === "product-delete") {

        const [err, data] = await tryit(productEntity.deleteProduct(values.productId as string))

        if (err) {
            return badRequest({ action: "product-delete", message: errorMessage(err) })
        }

        return redirect(`/admin/products`)
    }

    return null
}

export default function SingleProductInformation() {
    const context = useOutletContext<ProductOutletContext>()
    const product = context.product as Product
    const productTypes = context.productTypes
    const productInfo = product.info
    const categories = context?.categories && context?.categories.filter(c => c.type === "generic")
    const compositions = context.compositions

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    return (
        <div className="p-4">
            <div className="flex flex-col gap-4">
                <Form method="post" className="w-full">
                    <div className="mb-4 flex justify-end">
                        <div className="flex gap-2">
                            <SubmitButton actionName="product-delete" size="lg" idleText="Excluir" loadingText="Excluindo" variant={"destructive"} />
                            <SubmitButton actionName="product-info-update" size="lg" />
                        </div>
                    </div>
                    <div className="border-2 border-muted rounded-lg px-4 py-8">
                        <Input type="hidden" name="productId" defaultValue={product.id || undefined} />

                        {/* Tipo de produto */}

                        <Fieldset>
                            <div className="flex justify-between items-start ">
                                <Label htmlFor="description" className="pt-2">Tipo</Label>
                                <div className="flex flex-col gap-2 w-[300px]">
                                    <Select name="type" defaultValue={productInfo?.type} required >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup >
                                                {productTypes && productTypes.map((type, idx) => {
                                                    return <SelectItem key={idx} value={type.value}>{type.label}</SelectItem>
                                                })}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Fieldset>

                        {/* Descrição de produto */}

                        <Fieldset>
                            <div className="flex justify-between">
                                <Label htmlFor="description" className="pt-2">Descrição produto</Label>
                                <Textarea id="description" name="description" placeholder="Descrição" defaultValue={productInfo?.description} className="max-w-[300px]" />
                            </div>
                        </Fieldset>

                        {/* Categoria de produto */}

                        <Fieldset>
                            <div className="flex justify-between items-start ">
                                <Label htmlFor="description" className="pt-2">Categoria</Label>
                                <div className="flex flex-col gap-2 w-[300px]">
                                    <Select name="type" defaultValue={jsonStringify(productInfo?.category)} >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup >
                                                {categories && categories.map((c, idx) => {
                                                    return <SelectItem key={idx} value={jsonStringify(c) || ""}>{c.name}</SelectItem>
                                                })}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Fieldset>

                    </div>
                </Form>
                <div className="flex flex-col gap-4 border-2 border-muted rounded-lg px-4 py-8">
                    <span className="text-sm">Este produto é presente na composição de outros produtos:</span>
                    <ul className="flex gap-2">
                        {compositions?.map(c => {

                            return (
                                <li key={c.id} className="bg-slate-200 rounded-xl py-1 px-4 hover:bg-slate-50 cursor-pointer">
                                    <Link to={`/admin/products/${c.id}/components`}>
                                        <span className="font-semibold">{c.name}</span>
                                    </Link>
                                </li>
                            )

                        })}
                    </ul>
                </div>
            </div>
        </div>
    )

}