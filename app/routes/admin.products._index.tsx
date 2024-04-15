import { Separator } from "@radix-ui/react-separator"
import type { ActionArgs, LoaderArgs } from "@remix-run/node"
import { useLoaderData, useNavigation, Form, Link, useActionData } from "@remix-run/react"
import { useState } from "react"
import Container from "~/components/layout/container/container"
import { TableTitles, TableRows, TableRow, Table, EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import ProductTypeBadge from "~/domain/product/components/product-type-badge/product-type-badge"
import { ProductEntity, productPrismaEntity } from "~/domain/product/product.entity"
import { IProduct, type Product } from "~/domain/product/product.model.server"
import { cn } from "~/lib/utils"
import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"


export async function loader({ request }: LoaderArgs) {

    const [err, products] = await tryit(productPrismaEntity.findAll())

    if (err) {
        return serverError(err)
    }

    return ok({ products })

}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "product-delete") {

        const [err, data] = await tryit(productPrismaEntity.delete(values.id as string))

        if (err) {
            return serverError(err)
        }

        return ok({ message: "Produto deletado com sucesso" })
    }

    return null
}



export default function ProducstIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const products = loaderData?.payload.products as Product[]

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    const [searchTerm, setSearchTerm] = useState("")

    const productsFilteredBySearch = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <Container>
            <div className="flex flex-col gap-2">
                <div data-element="filters" className="flex justify-between border rounded-md p-4 mb-2">

                    {/* <ProductsFilters /> */}

                    <ProductsSearch onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value
                        setSearchTerm(value)
                    }} />
                </div>

                <ul data-element="products" className="flex flex-col gap-4 md:grid md:grid-cols-3">
                    {
                        productsFilteredBySearch.map(p => <ProductItem item={p} key={p.id} />)
                    }
                </ul>
            </div>
        </Container>
    )
}

interface ProductItemProps {
    item: IProduct
}

function ProductItem({ item }: ProductItemProps) {
    return (
        <Form method="post"
            className="flex flex-col p-4
                                rounded-lg border border-muted hover:border-muted-foreground hover:cursor-pointer w-full">

            <div className="flex items-center justify-between w-full mb-4">
                <h3 className="text-md font-semibold tracking-tight">{item.name}</h3>
                <EditItemButton to={`/admin/products/${item.id}`} />
            </div>

            <Separator className="mb-4" />

            <div className="flex gap-2 md:gap-2 justify-end">
                <DeleteItemButton actionName="product-delete" />
                <Input type="hidden" name="id" value={item.id} />
            </div>
        </Form>
    )
}


/**
function ProductsFilters() {

    const productTypes = ProductEntity.findAllProductTypes()

    return (
    <div className="flex gap-4 items-center">
                        <span className="text-sm">Filtrar por:</span>
                        <ul className="flex gap-2 flex-wrap">
            <li key={"all"}>
                <Link to={`/admin/products?type=all`}>
                    <span className="border px-4 py-1 rounded-full text-xs text-gray-800 font-semibold tracking-wide max-w-max">Todos</span>
                </Link>
            </li>
            {
                productTypes.map((type) => {
                    return (
                        <li key={type.value}>
                            <Link to={`/admin/products?type=${type.value}`}
                                className={cn("text-sm")}>
                                <ProductTypeBadge type={type.value} />
                            </Link>
                        </li>
                    )
                })
            }
        </ul >
                    </div >


    )

}

 */

function ProductsSearch({ ...props }) {
    return (
        <div className="flex gap-4">
            <Input type="text" name="search" placeholder="Buscar" className="w-full" {...props} />
        </div>
    )
}