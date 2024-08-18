
import { ActionFunctionArgs, ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { categoryEntity } from "~/domain/category/category.entity.server";
import { Category, CategoryType } from "~/domain/category/category.model.server";
import CategoryForm from "~/domain/category/components/category-form/category-form";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request, params }: LoaderFunctionArgs) {

    const categoryId = params.id

    if (!categoryId) {
        return badRequest({ message: "Id da categoria não informado" })
    }

    const [err, category] = await tryit(categoryEntity.findById(categoryId))

    if (err) {
        return badRequest(err)
    }

    return ok({
        category,
        types: categoryEntity.getTypes(),
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

        const [err, data] = await tryit(categoryEntity.update(category.id, {
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

        // before remove the category it is required to check if the category has products
        // const [err, data] = await tryit(productEntity.findAllByCategory(category.id))

        // if (err) {
        //     return badRequest(err)
        // }

        // const [err, data] = await tryit(productEntity.deleteProduct(values.productId as string))

        // if (err) {
        //     return badRequest({ action: "product-delete", message: errorMessage(err) })
        // }

        // return redirect(`/admin/products`)

        return badRequest("Ainda nao implementado")
    }

    return null
}


export default function CategorySingle() {
    const loaderData = useLoaderData<typeof loader>()
    const category = loaderData?.payload.category as Category

    return (
        <div className="flex flex-col gap-6">
            <h3 className="text-xl font-semibold text-muted-foreground mb-3">{`Categoria: ${category?.name}` || "Categoria"}</h3>
            <div className="border rounded-md p-4">
                <CategoryForm action={"category-update"} category={category} />
            </div>
        </div>
    )
}

