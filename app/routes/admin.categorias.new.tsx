import { ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { Category, CategoryType } from "~/domain/category/category.model.server";
import CategoryForm from "~/domain/category/components/category-form/category-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader() {

    const categoryTypes = categoryPrismaEntity.getTypes()

    return ok({
        types: categoryTypes
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

    if (_action === "category-create") {
        const [err, itemCreated] = await tryit(categoryPrismaEntity.create({
            name: category.name,
            type: category.type,
            sortOrder: category.sortOrder ?? 0,
        }))

        if (err) {
            return serverError(err)
        }

        return ok()
    }

    return null
}

export default function AdminCategoriaNew() {
    const loaderData = useLoaderData<typeof loader>()
    const types = loaderData?.payload.types || []

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle>Nova categoria</CardTitle>
            </CardHeader>
            <CardContent>
                <CategoryForm action={"category-create"} types={types} />
            </CardContent>
        </Card>
    )
}
