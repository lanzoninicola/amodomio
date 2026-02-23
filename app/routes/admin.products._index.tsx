import { Separator } from "@radix-ui/react-separator"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, Form, Link, useActionData } from "@remix-run/react"
import { useState } from "react"
import Container from "~/components/layout/container/container"
import { EditItemButton, DeleteItemButton } from "~/components/primitives/table-list"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import ProductTypeBadge from "~/domain/product/components/product-type-badge/product-type-badge"
import type { Product } from "~/domain/product/product.model.server"
import { deleteProduct, listProducts } from "~/modules/products/product.service.server"
import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import { PlusCircle, Search } from "lucide-react"


export async function loader({ request }: LoaderFunctionArgs) {

    const [err, products] = await tryit(listProducts())

    if (err) {
        return serverError(err)
    }

    return ok({ products })

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "product-delete") {

        const [err, data] = await tryit(deleteProduct(values.id as string))

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
            <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produtos</div>
                        <div className="text-2xl font-black text-slate-900 tabular-nums">{productsFilteredBySearch.length}</div>
                        <div className="text-xs text-slate-500">itens encontrados</div>
                    </div>
                    <div className="flex w-full md:w-auto items-center gap-2">
                        <ProductsSearch onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const value = e.target.value
                            setSearchTerm(value)
                        }} />
                        <Link
                            to="/admin/products/new"
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700"
                        >
                            <PlusCircle size={16} />
                            Novo
                        </Link>
                    </div>
                </div>

                <ul data-element="products" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {
                        productsFilteredBySearch.map(p => <ProductItem item={p} key={p.id} />)
                    }
                </ul>
            </div>
        </Container>
    )
}

interface ProductItemProps {
    item: Product
}

function ProductItem({ item }: ProductItemProps) {
    const measurement = (item as any)?.Measurement
    const factor = measurement?.purchaseToConsumptionFactor
    const purchaseUm = measurement?.purchaseUm
    const consumptionUm = measurement?.consumptionUm

    return (
        <Form method="post"
            className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-4 transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">

            <div className="flex items-start justify-between w-full mb-3 gap-2">
                <div className="flex flex-col gap-2">
                    <h3 className="text-base font-semibold tracking-tight text-slate-900">{item.name}</h3>
                    <div className="flex items-center gap-2">
                        <ProductTypeBadge type={item.info?.type || null} />
                    </div>
                    {measurement ? (
                        <div className="text-xs text-slate-500">
                            1 {purchaseUm} = {Number(factor || 0).toFixed(6)} {consumptionUm}
                        </div>
                    ) : null}
                </div>
                <EditItemButton to={`/admin/products/${item.id}`} />
            </div>

            <Separator className="mb-3" />

            <div className="flex gap-2 justify-end">
                <DeleteItemButton actionName="product-delete" />
                <Input type="hidden" name="id" value={item.id} />
            </div>
        </Form>
    )
}


function ProductsSearch({ ...props }) {
    return (
        <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input type="text" name="search" placeholder="Buscar produto..." className="w-full pl-9" {...props} />
        </div>
    )
}
