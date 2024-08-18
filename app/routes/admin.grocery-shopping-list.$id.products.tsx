import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Link, useNavigate, Form } from "@remix-run/react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { toast } from "~/components/ui/use-toast";
import { groceryListEntity } from "~/domain/grocery-list/grocery-list.entity.server";
import { GroceryListItem } from "~/domain/grocery-list/grocery-list.model.server";
import { TCategoryProducts, productEntity } from "~/domain/product/product.entity";
import { Product } from "~/domain/product/product.model.server";
import { cn } from "~/lib/utils";
import { serverError, ok } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

export async function loader({ request, params }: LoaderFunctionArgs) {
    if (params?.id) {
        redirect("/admin/grocery-shopping-list")
    }

    const listId = params?.id

    const [err, categoriesProducts] = await tryit(productEntity.findAllGroupedByCategory())

    if (err) {
        return serverError(err)
    }

    if (!categoriesProducts) {
        return ok({

            listId,
            products: []
        })
    }

    const productsReturned = Object.keys(categoriesProducts).map(categoryName => {
        const products = categoriesProducts[categoryName]
        return {
            categoryName,
            products: products.filter(p => p.info?.type !== "processed" && p.info?.type !== "topping")
        }
    })

    return ok({
        listId,
        products: productsReturned
    })

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (_action === "add-products") {

        const listId = values.listId as string
        const selectAll = values?.selectAll === "on" || false as boolean


        if (selectAll === true) {
            const products = await productEntity.findAll()
            const productsEligible = products.filter(p => p.info?.type !== "processed" && p.info?.type !== "topping")

            const [err] = await tryit(groceryListEntity.addBulkItems(listId, productsEligible as GroceryListItem[]))

            if (err) {
                return serverError(err)
            }

            return redirect(`/admin/grocery-shopping-list/${listId}`)

        }

        let nextValues = { ...values }
        delete nextValues.listId
        delete nextValues.selectAll

        if (!nextValues) {
            return null
        }

        const listItems = Object.values(nextValues).map(jsonParse)

        const [err] = await tryit(groceryListEntity.addBulkItems(listId, listItems as GroceryListItem[]))

        if (err) {
            return serverError(err)
        }

        return redirect(`/admin/grocery-shopping-list/${listId}`)
    }

    return null
}


export default function SingleGroceryListAddProducts() {
    const [selectAll, setSelectAll] = useState(false)

    const loaderData = useLoaderData<typeof loader>()
    const listId = loaderData?.payload.listId as string
    const categoriesProducts = loaderData?.payload.products as { categoryName: string, products: Product[] }[]

    const navigate = useNavigate()
    const goBack = () => navigate(-1)

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
        <div className="flex flex-col border rounded-lg p-4 max-h-[520px]">
            <Form method="post">
                <input type="hidden" name="listId" value={listId} />
                <div className="overflow-y-auto mb-6 max-h-[320px]">
                    <div>
                        <div className="py-2 px-4 rounded-lg  mb-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">Selecionar tudo</span>
                                <Switch name="selectAll" onCheckedChange={() => setSelectAll(!selectAll)} />
                            </div>
                        </div>

                        <ul>
                            {categoriesProducts.map((categoryProduct, idx) => {

                                return (
                                    <li key={idx} className="py-2 px-1 rounded-lg mb-2">
                                        <div className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold">{categoryProduct.categoryName}</span>
                                            <ul>
                                                {
                                                    categoryProduct.products.map(p => {
                                                        return (
                                                            <li key={p.id} className="py-2 px-2 rounded-lg bg-slate-50 mb-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span>{p.name}</span>
                                                                    <Switch name={p.id} disabled={selectAll} value={jsonStringify(p)} />
                                                                </div>
                                                            </li>
                                                        )
                                                    })
                                                }
                                            </ul>
                                        </div>
                                    </li>

                                )

                            })}
                        </ul>

                        {/* <ul className={cn(selectAll && "opacity-30")}>
                            {products?.map(p => {
                                return (
                                    <li key={p.id} className="py-2 px-4 rounded-lg bg-slate-50 mb-2">
                                        <div className="flex justify-between items-center">
                                            <span>{p.name}</span>
                                            <Switch name={p.id} disabled={selectAll} value={jsonStringify(p)} />
                                        </div>
                                    </li>
                                )
                            })}
                        </ul> */}

                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <Button className="w-full font-semibold bg-brand-green focus:bg-brand-green/30"
                        type="submit" name="_action" value="add-products">Salvar</Button>
                    <Button className="w-full font-semibold" onClick={goBack}>Fechar</Button>
                </div>
            </Form>
        </div>


    )
}