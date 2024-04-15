import { redirect, type ActionArgs, type LoaderArgs } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { useState } from "react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import type { Category, TCategory } from "~/domain/category/category.model.server";
import SelectCategory from "~/domain/category/components/select-categories/select-categories";
import { productPrismaEntity } from "~/domain/product/product.entity";
import { IProduct, type Product } from "~/domain/product/product.model.server";
import type { HttpResponse } from "~/utils/http-response.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";
import { lastUrlSegment, urlAt } from "~/utils/url";

export interface ProductOutletContext {
    product: Product | null
    categories: Category[] | null
}


export async function loader({ request }: LoaderArgs) {
    const productId = urlAt(request.url, -1)

    if (!productId) {
        return null
    }

    const product = await productPrismaEntity.findById(productId)

    if (!product) {
        return badRequest({ message: "Produto não encontrado" })
    }

    let categories = null

    if (product?.id) {
        categories = await categoryPrismaEntity.findAll()
    }


    return ok({
        product,
        categories,
    })

}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "product-name-update") {
        const product = await productPrismaEntity.findById(values?.productId as string)

        const [err, data] = await tryit(productPrismaEntity.update(values.productId as string, {
            ...product,
            name: values.name as string
        }))

        if (err) {
            return badRequest(err)
        }

        return redirect(`/admin/products/${values.productId}`)
    }

    return null
}


export default function SingleProduct() {
    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()

    const product = loaderData?.payload?.product as IProduct
    const categories = loaderData?.payload?.categories as TCategory[]

    const productId = product?.id

    const activeTabStyle = "bg-white text-black font-semibold rounded-md py-1"

    return (
        <>
            <div className="mb-8">

                <div className="md:grid md:grid-cols-2 md:items-start flex flex-col gap-4 border rounded-md p-4 ">
                    <div className="flex flex-col gap-4">
                        <ProductName />
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2 items-center">
                                <span className="text-sm">Categoria</span>
                                <SelectCategory categories={categories} />
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-sm">Sub-categoria</span>
                                <SelectCategory categories={categories} />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center justify-end">
                        <span className="text-sm">Publicar no menu</span>
                        <Switch name={product.id} value={String(product.showInMenu)} />
                    </div>

                </div>


            </div>

            <div className="grid grid-cols-2 grid-rows-3 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-6 h-20
                                md:grid-cols-2 md:grid-rows-1 md:h-10
                            ">
                <Link to={`/admin/products/${productId}/pricing`} className="w-full text-center">
                    <div className={`${activeTab === "pricing" && activeTabStyle} ${activeTab}`}>
                        <span>Preços</span>
                    </div>
                </Link >

                <Link to={`/admin/products/${productId}/dashboard`} className="w-full text-center">
                    <div className={`${activeTab === "dashboard" && activeTabStyle}`}>
                        <span>Relatorio</span>
                    </div>
                </Link>
            </div >

            <Outlet context={{ product, categories }} />
        </>
    )
}


function ProductName() {
    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()
    const product = loaderData?.payload?.product as Product

    const [name, setName] = useState(product?.name || "Produto singolo")
    const [isNameChanged, setIsNameChanged] = useState(false)

    return (
        <Form method="post">
            <input type="hidden" name="productId" value={product?.id} />
            <div className="flex gap-2 mb-3 items-center">
                <div className="flex gap-2 items-center">
                    <span className="text-xl font-semibold text-muted-foreground">Produto:</span>
                    <InputItem className="text-xl font-semibold text-muted-foreground w-max" ghost={true}
                        name="name"
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setName(e.target.value)
                            setIsNameChanged(true)
                        }}
                    />
                </div>
                {isNameChanged &&
                    product?.name !== name &&
                    <SaveItemButton actionName="product-name-update" />}
            </div>
        </Form>
    )
}