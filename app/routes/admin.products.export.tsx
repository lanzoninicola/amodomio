import { LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useNavigation, Form } from "@remix-run/react"

import { useState } from "react"
import Container from "~/components/layout/container/container"
import { Table, TableTitles, TableRows, TableRow, EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { Category } from "~/domain/category/category.model.server"
import ProductTypeBadge from "~/domain/product/components/product-type-badge/product-type-badge"
import { TCategoryProducts, productEntity } from "~/domain/product/product.entity"
import { Product } from "~/domain/product/product.model.server"
import { cn } from "~/lib/utils"
import { serverError, ok } from "~/utils/http-response.server"
import { jsonParse } from "~/utils/json-helper"
import tryit from "~/utils/try-it"



export async function loader({ request }: LoaderFunctionArgs) {

    // const productTypeParam = getSearchParam({ request, paramName: "type" })

    // if (productTypeParam && productTypeParam !== "all") {
    //     const [err, products] = await tryit(productEntity.findByType(productTypeParam as ProductType))

    //     if (err) {
    //         return serverError(err)
    //     }

    //     return ok({ products })
    // }

    const [err, products] = await tryit(productEntity.findAll())

    if (err) {
        return serverError(err)
    }

    return ok({ products })


}

export default function ProductsExport() {
    const loaderData = useLoaderData<typeof loader>()
    const products = loaderData?.payload.products as Product[]

    return (
        <ul>
            {products.map((p) => {

                const category = jsonParse(p.info?.category) as Category

                return <li key={p.id}>{category.name},{p.name}</li>
            })}
        </ul>
    )


}

