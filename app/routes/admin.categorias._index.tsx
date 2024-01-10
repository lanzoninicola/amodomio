import type { LoaderArgs } from "@remix-run/node";
import { redirect, type V2_MetaFunction } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import { Edit, Trash } from "lucide-react";
import Container from "~/components/layout/container/container";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { categoryEntity } from "~/domain/category/category.entity.server";
import type { Category } from "~/domain/category/category.model.server";
import { ok } from "~/utils/http-response.server";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Categorias | A Modo Mio",
        }
    ];
};


export async function loader() {
    const categories = await categoryEntity.findAll()
    return ok({ categories })
}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "category-edit") {

        const category: Category = {
            id: values.id as string,
            name: values.name as string,
            type: "menu",
            visible: values.visible === "on" ? true : false,
            default: values.default === "on" ? true : false
        }

        await categoryEntity.update(values.id as string, category)
    }

    if (_action === "category-delete") {
        await categoryEntity.delete(values.id as string)
        return redirect(`/admin/categorias`)
    }

    if (_action === "item-sortorder-up") {
        await categoryEntity.sortUp(values.id as string)
    }

    if (_action === "item-sortorder-down") {
        await categoryEntity.sortDown(values.id as string)
    }

    return null
}

export default function AdminCategoriasIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]

    const categoriesSorted = categories.sort((a, b) => (a?.sortOrder || 0) - (b?.sortOrder || 0))

    return (

        <ul className="min-w-[350px]">
            {
                categoriesSorted.map(category => {
                    return (
                        <li key={category.id} className="mb-4">
                            <CategoryItem category={category} />
                        </li>
                    )
                })
            }
        </ul>
    )
}






interface CategoryItemProps {
    category: Category
}

function CategoryItem({ category }: CategoryItemProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")

    return (
        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full`}>

            <SortingOrderItems enabled={action === "categories-sortorder"} itemId={category.id}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-lg font-bold tracking-tight">{category.name}</h2>
                    <Link to={`${category.id}`} >
                        <Edit size={24} className="cursor-pointer" />
                    </Link>
                </div>
                <div className="flex justify-between w-full">
                    <span className="font-semibold text-sm">Pública no cardápio</span>
                    <Switch id="visible" name="visible" defaultChecked={category.visible} disabled />
                </div>
            </SortingOrderItems>
        </div>
    )
}

