import type { ActionArgs, LoaderArgs } from "@remix-run/node"
import { useLoaderData, useNavigation, Form, Link, useActionData } from "@remix-run/react"
import { useState } from "react"
import Container from "~/components/layout/container/container"
import { TableTitles, TableRows, TableRow, Table, EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import ProductTypeBadge from "~/domain/product/components/product-type-badge/product-type-badge"
import { ProductEntity, productPrismaEntity } from "~/domain/product/product.entity"
import type { ProductType } from "~/domain/product/product.model.server"
import { type Product } from "~/domain/product/product.model.server"
import { cn } from "~/lib/utils"
import errorMessage from "~/utils/error-message"
import getSearchParam from "~/utils/get-search-param"
import { badRequest, ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"


export async function loader({ request }: LoaderArgs) {

    const productTypeParam = getSearchParam({ request, paramName: "type" })

    if (!productTypeParam || productTypeParam === "all") {
        const [err, products] = await tryit(productPrismaEntity.findAll())

        if (err) {
            return serverError(err)
        }

        return ok({ products })
    }

    const [err, products] = await tryit(productPrismaEntity.findByType(productTypeParam as ProductType))

    if (err) {
        return serverError(err)
    }

    return ok({ products })

}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "product-delete") {

        const [err, data] = await tryit(productPrismaEntity.deleteProduct(values.id as string))

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
            <div className="flex flex-col gap-2">
                <div data-element="filters" className="flex justify-between border rounded-md p-4 mb-2">
                    <div className="flex gap-4 items-center">
                        <span className="text-sm">Filtrar por:</span>
                        <ProductsFilters />
                    </div>
                    <ProductsSearch onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value
                        setSearchTerm(value)
                    }} />
                </div>

                <Table>
                    <TableTitles
                        clazzName="grid-cols-5"
                        titles={[
                            "Ações",
                            "Nome",
                            "Tipo",
                            "Criado em",
                            "Atualizado em",
                        ]}
                    />
                    <TableRows>
                        {productsFilteredBySearch.map((p) => {
                            return <ProductTableRow key={p.id} product={p} className="grid-cols-5" />;
                        })}
                    </TableRows>
                </Table>
            </div>
        </Container>
    )
}


interface ProductTableRowProps {
    product: Product;
    className?: string;
}

function ProductTableRow({ product, className }: ProductTableRowProps) {
    const navigation = useNavigation()

    return (

        <Form method="post" >
            <TableRow
                row={product}
                isProcessing={navigation.state !== "idle"}
                className={cn("grid-cols-5 text-sm p-0", className)}
            >
                <div className="flex gap-2 md:gap-2">
                    <EditItemButton to={`/admin/products/${product.id}/info`} />
                    <DeleteItemButton actionName="product-delete" />
                </div>
                <div>
                    <Input type="hidden" name="id" value={product.id} />
                    <Input name="name" defaultValue={product.name} className="border-none w-full" readOnly />
                </div>
                <ProductTypeBadge type={product?.info?.type} />
            </TableRow>
        </Form>
    )
}



function ProductsFilters() {

    const productTypes = ProductEntity.findAllProductTypes()

    return (
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
    )

}


interface ProductsSearchProps {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function ProductsSearch({ ...props }) {
    return (
        <div className="flex gap-4">
            <Input type="text" name="search" placeholder="Buscar" className="w-full" {...props} />
        </div>
    )
}
