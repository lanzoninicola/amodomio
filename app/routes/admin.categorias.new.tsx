import { LoaderArgs } from "@remix-run/node";
import { categoryEntity } from "~/domain/category/category.entity.server";
import { Category } from "~/domain/category/category.model.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "category-create") {
        const category: Category = {
            name: values.name as string || "",
            type: "menu",
            visible: values.visible === "on" ? true : false,
            sortOrder: values?.sortOrder ? parseInt(values.sortOrder as string) : 0,
            default: values.default === "on" ? true : false
        }

        const [err, itemCreated] = await tryit(categoryEntity.create(category))

        if (err) {
            return serverError(err)
        }

        return ok()
    }

    return null
}

export default function AdminCategoriaNew() {
    return <div>admin categoria new</div>
}