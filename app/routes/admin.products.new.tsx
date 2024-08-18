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
import { categoryEntity } from "~/domain/category/category.entity.server";
import { Category } from "~/domain/category/category.model.server";
import SelectProductUnit from "~/domain/product/components/select-product-unit/select-product-unit";
import { ProductEntity, ProductTypeHTMLSelectOption, productPrismaEntity } from "~/domain/product/product.entity";
import type { Product, ProductType, ProductUnit } from "~/domain/product/product.model.server";
import getSearchParam from "~/utils/get-search-param";
import { ok, serverError } from "~/utils/http-response.server";
import { jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";


export async function loader({ request, params }: ActionFunctionArgs) {
    const products = await productPrismaEntity.findAll()
    const categories = await categoryEntity.findAll()
    const types = ProductEntity.findAllProductTypes()

    // this is used when a component is added to the product
    const callbackUrl = getSearchParam({ request, paramName: "callbackUrl" })

    return ok({
        products,
        callbackUrl: callbackUrl || "",
        categories: categories.filter(c => c.type === "product"),
        types
    })
}

export async function action({ request, params }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const callbackUrl = values?.callbackUrl as string

    if (_action === "product-create") {

        const type = values.type as ProductType
        const category = await categoryEntity.findById(values?.categoryId as string)


        const [err, data] = await tryit(productPrismaEntity.create({
            name: values.name as string,
            unit: values.unit as ProductUnit,
            info: {
                type,
                // @ts-ignore
                category: jsonStringify(category),
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
    const types: ProductTypeHTMLSelectOption[] = loaderData?.payload.types || []

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
    const productsFilteredBySearch = products.filter(p => p.info?.type !== "topping").filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

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

                                    <div className="max-w-[150px]">
                                        <Label htmlFor="unit">Unidade</Label>
                                        <SelectProductUnit />
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