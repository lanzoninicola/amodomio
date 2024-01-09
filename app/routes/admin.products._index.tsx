import type { ActionArgs, LoaderArgs } from "@remix-run/node"
import { useLoaderData, useNavigation, Form, Link, useActionData } from "@remix-run/react"
import Container from "~/components/layout/container/container"
import { TableTitles, TableRows, TableRow, Table, EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import ProductTypeBadge from "~/domain/product/components/product-type-badge/product-type-badge"
import { ProductEntity, productEntity } from "~/domain/product/product.entity"
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
        const [err, products] = await tryit(productEntity.findAll())

        if (err) {
            return serverError(err)
        }

        return ok({ products })
    }

    const [err, products] = await tryit(productEntity.findByType(productTypeParam as ProductType))

    if (err) {
        return serverError(err)
    }

    return ok({ products })

}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "product-delete") {

        const [err, data] = await tryit(productEntity.deleteProduct(values.id as string))

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

    if (status === 500) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    return (
        <Container>
            <div className="flex flex-col gap-2">
                <div data-element="filters" className="flex gap-4 items-center border rounded-md p-4 mb-2">
                    <span className="text-sm">Filtrar por:</span>
                    <ProductsFilters />
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
                        {products.map((p) => {
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
        <ul className="flex gap-2">
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
                                className={cn("text-sm", type.value === "pizza" ? "text-violet-500" : "text-gray-500")}>
                                <ProductTypeBadge type={type.value} />
                            </Link>
                        </li>
                    )
                })
            }
        </ul >
    )

}
