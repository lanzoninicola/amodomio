import { redirect, type ActionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
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
import { ProductEntity, ProductTypeHTMLSelectOption, productEntity } from "~/domain/product/product.entity";
import type { ProductType, ProductUnit } from "~/domain/product/product.model.server";
import getSearchParam from "~/utils/get-search-param";
import { ok, serverError } from "~/utils/http-response.server";
import { jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";


export async function loader({ request, params }: ActionArgs) {
    const categories = await categoryEntity.findAll()
    const types = ProductEntity.findAllProductTypes()

    // this is used when a component is added to the product
    const callbackUrl = getSearchParam({ request, paramName: "callbackUrl" })

    return ok({
        callbackUrl: callbackUrl || "",
        categories,
        types
    })
}

export async function action({ request, params }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const callbackUrl = values?.callbackUrl as string

    if (_action === "product-create") {

        const type = values.type as ProductType
        const category = await categoryEntity.findById(values?.categoryId as string)


        const [err, data] = await tryit(productEntity.create({
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
    const callbackUrl = loaderData?.payload.callbackUrl
    const categories: Category[] = loaderData?.payload.categories
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

    return (
        <Container>
            <Card>
                <CardHeader>
                    <CardTitle>Novo Produto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <Form method="post"  >

                        <div className="flex gap-2">
                            <input type="hidden" name="callbackUrl" value={callbackUrl} />
                            <Fieldset>
                                <Label htmlFor="product-name">Nome</Label>
                                <Input type="string" id="product-name" placeholder="Nome produto" name="name" required />
                            </Fieldset>
                            <Fieldset>

                                <div className="max-w-[150px]">
                                    <Label htmlFor="unit">Unidade</Label>
                                    <SelectProductUnit />
                                </div>
                            </Fieldset>
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

                        {/* Descrição de produto */}

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