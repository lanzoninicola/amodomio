import { LoaderFunctionArgs } from "@remix-run/node";
import { categoryEntity } from "~/domain/category/category.entity.server";
import { Category, CategoryType } from "~/domain/category/category.model.server";
import CategoryForm from "~/domain/category/components/category-form/category-form";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader() {

    const categoryTypes = categoryEntity.getTypes()

    return ok({
        types: categoryTypes
    })
}


export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const category: Category = {
        id: values?.id as string,
        name: values.name as string,
        type: values.type as CategoryType,
        sortOrder: Number(values.sortOrder) || 0 as number,
    }

    if (_action === "category-create") {
        const [err, itemCreated] = await tryit(categoryEntity.create(category))

        if (err) {
            return serverError(err)
        }

        return ok()
    }

    return null
}

export default function AdminCategoriaNew() {
    return (
        <div className="flex flex-col gap-6">
            <h3 className="text-xl font-semibold text-muted-foreground mb-3">Nova categoria</h3>
            <div className="border rounded-md p-4">
                <CategoryForm action={"category-create"} />
            </div>
        </div>
    )
}