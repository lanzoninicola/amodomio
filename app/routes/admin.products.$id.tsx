import { redirect, type ActionArgs, type LoaderArgs } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { useState } from "react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import { categoryEntity, categoryPrismaEntity } from "~/domain/category/category.entity.server";
import type { Category } from "~/domain/category/category.model.server";
import { ProductEntity, productPrismaEntity } from "~/domain/product/product.entity";
import type { ProductComponent, ProductType } from "~/domain/product/product.model.server";
import { type Product } from "~/domain/product/product.model.server";
import type { HttpResponse } from "~/utils/http-response.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";
import { lastUrlSegment, urlAt } from "~/utils/url";

export interface ProductOutletContext {
    product: Product | null
    categories: Category[] | null
    productTypes: { value: ProductType, label: string }[] | null
    compositions: Product[]
}


export async function loader({ request }: LoaderArgs) {
    const productId = urlAt(request.url, -2)

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

        return redirect(`/admin/products/${values.productId}/info`)
    }

    return null
}


export default function SingleProduct() {
    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()

    const product = loaderData?.payload?.product as Product
    const components = loaderData?.payload?.components as ProductComponent[]
    const categories = loaderData?.payload?.categories as Category[]
    const productTypes = loaderData?.payload?.productTypes as ProductType[]
    const compositions = loaderData?.payload?.compositions as Product[]

    const productId = product?.id

    const activeTabStyle = "bg-white text-black font-semibold rounded-md py-1"

    const productType = product?.info?.type

    return (
        <>
            <div className="mb-8">
                {/* <h3 className="text-xl font-semibold text-muted-foreground mb-3">{`Produto: ${product?.name}` || "Produto singolo"}</h3> */}
                <ProductName />
            </div>


            <div className="grid grid-cols-2 grid-rows-3 md:grid-cols-5 md:grid-rows-1 h-20 md:h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-6">
                <Link to={`/admin/products/${productId}`} className="w-full text-center">
                    <div className={`${activeTab === "info" && activeTabStyle} ${activeTab}`}>
                        <span>Dados gerais</span>
                    </div>

                </Link >

                {
                    (productType === "topping" || productType === "processed") &&
                    <Link to={`/admin/products/${productId}/components`} className="w-full text-center">
                        <div className={`${activeTab === "components" && activeTabStyle} ${activeTab}`}>
                            <span>Componentes</span>
                        </div>

                    </Link >
                }
                <Link to={`/admin/products/${productId}/pricing`} className="w-full text-center">
                    <div className={`${activeTab === "pricing" && activeTabStyle} ${activeTab}`}>
                        <span>Preços</span>
                    </div>
                </Link >
                {/* {
                    (productType === "simple" || productType === "topping") &&
                    <Link to={`/admin/products/${productId}/menu`} className="w-full text-center">
                        <div className={`${activeTab === "menu" && activeTabStyle} ${activeTab}`}>
                            <span>Cardápio</span>
                        </div>
                    </Link >
                } */}
                <Link to={`/admin/products/${productId}/dashboard`} className="w-full text-center">
                    <div className={`${activeTab === "dashboard" && activeTabStyle}`}>
                        <span>Relatorio</span>
                    </div>
                </Link>
            </div >

            <Outlet context={{ product, components, categories, productTypes, compositions }} />
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