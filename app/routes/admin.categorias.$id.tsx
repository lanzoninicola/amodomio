import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { Category, CategoryType } from "~/domain/category/category.model.server";
import CategoryForm from "~/domain/category/components/category-form/category-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import prismaClient from "~/lib/prisma/client.server";


export async function loader({ request, params }: LoaderFunctionArgs) {

    const categoryId = params.id

    if (!categoryId) {
        return badRequest({ message: "Id da categoria não informado" })
    }

    const [err, category] = await tryit(categoryPrismaEntity.findById(categoryId))

    if (err) {
        return badRequest(err)
    }

    return ok({
        category,
        types: categoryPrismaEntity.getTypes(),
    })
}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const category: Category = {
        id: values?.id as string,
        name: values.name as string,
        type: values.type as CategoryType,
        sortOrder: Number(values.sortOrder) || 0 as number,
    }

    if (category?.id === undefined) {
        return badRequest({ message: "Id da categoria não informado" })
    }

    if (_action === "category-update") {

        const [err, data] = await tryit(categoryPrismaEntity.update(category.id, {
            name: category.name,
            type: category.type,
            sortOrder: category.sortOrder,
        }))

        if (err) {
            return badRequest(err)
        }

        return ok({ message: "Atualizado com successo" })
    }

    if (_action === "category-delete") {
        const db = prismaClient as any

        const [linkedItems, linkedSellingInfos] = await Promise.all([
            db.item.findMany({
                where: { categoryId: category.id },
                select: { id: true, name: true },
                orderBy: [{ name: "asc" }],
                take: 100,
            }),
            db.itemSellingInfo.findMany({
                where: { categoryId: category.id },
                select: {
                    itemId: true,
                    Item: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                take: 100,
            }),
        ])

        const linkedCommercialItems = linkedSellingInfos
            .map((row: any) => row.Item)
            .filter(Boolean)
            .filter((item: any, index: number, current: any[]) => current.findIndex((entry) => entry.id === item.id) === index)
            .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")))

        if (linkedItems.length > 0) {
            return badRequest({
                message: "Não é possível excluir esta categoria porque ela está vinculada a itens.",
                payload: {
                    action: "category-delete",
                    linkedItems,
                    linkedItemsCount: linkedItems.length,
                    categoryId: category.id,
                },
            })
        }

        if (linkedCommercialItems.length > 0) {
            return badRequest({
                message: "Não é possível excluir esta categoria porque ela está vinculada à venda de itens.",
                payload: {
                    action: "category-delete",
                    linkedCommercialItems,
                    linkedCommercialItemsCount: linkedCommercialItems.length,
                    categoryId: category.id,
                },
            })
        }

        const [err] = await tryit(categoryPrismaEntity.delete(category.id))
        if (err) {
            return badRequest(err)
        }

        return redirect("/admin/categorias")
    }

    return null
}


export default function CategorySingle() {
    const loaderData = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>() as any
    const category = loaderData?.payload.category as Category
    const types = loaderData?.payload.types || []
    const linkedItems = actionData?.payload?.linkedItems || []
    const linkedCommercialItems = actionData?.payload?.linkedCommercialItems || []
    const deleteActionFeedback = actionData && (linkedItems.length > 0 || linkedCommercialItems.length > 0)

    return (
        <div className="flex flex-col gap-4">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle>{`Categoria: ${category?.name}` || "Categoria"}</CardTitle>
                </CardHeader>
                <CardContent>
                    <CategoryForm action={"category-update"} category={category} types={types} />
                </CardContent>
            </Card>

            <Card id="delete-category" className="border-red-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-red-700">Excluir categoria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-slate-600">
                        Esta ação remove a categoria permanentemente. Se houver itens vinculados, a exclusão será bloqueada.
                    </p>

                    <Form method="post" className="flex items-center gap-2">
                        <input type="hidden" name="id" value={category?.id} />
                        <Button asChild type="button" variant="outline">
                            <Link to="/admin/categorias">Cancelar</Link>
                        </Button>
                        <SubmitButton
                            actionName="category-delete"
                            idleText="Excluir categoria"
                            loadingText="Excluindo..."
                            className="bg-red-600 hover:bg-red-700 md:max-w-max"
                            formNoValidate
                        />
                    </Form>

                    {deleteActionFeedback ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {actionData.message}
                        </div>
                    ) : null}

                    {linkedItems.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-900">
                                Itens vinculados ({actionData?.payload?.linkedItemsCount || linkedItems.length})
                            </p>
                            <p className="text-xs text-slate-600">
                                Atualize estes itens para uma nova categoria antes de excluir.
                            </p>
                            <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
                                <ul className="divide-y divide-slate-100">
                                    {linkedItems.map((item: any) => (
                                        <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                            <div className="min-w-0">
                                                <div className="truncate font-medium text-slate-900">{item.name}</div>
                                                <div className="text-xs text-slate-500">ID: {item.id}</div>
                                            </div>
                                            <Link to={`/admin/items/${item.id}/main`} className="text-xs underline">
                                                Abrir item
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : null}

                    {linkedCommercialItems.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-900">
                                Itens com venda vinculada ({actionData?.payload?.linkedCommercialItemsCount || linkedCommercialItems.length})
                            </p>
                            <p className="text-xs text-slate-600">
                                Atualize a categoria comercial desses itens antes de excluir.
                            </p>
                            <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
                                <ul className="divide-y divide-slate-100">
                                    {linkedCommercialItems.map((item: any) => (
                                        <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                            <div className="min-w-0">
                                                <div className="truncate font-medium text-slate-900">{item.name}</div>
                                                <div className="text-xs text-slate-500">ID: {item.id}</div>
                                            </div>
                                            <Link to={`/admin/items/${item.id}/venda/comercial`} className="text-xs underline">
                                                Abrir venda
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    )
}
