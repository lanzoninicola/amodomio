import type { LoaderArgs } from "@remix-run/node";
import { redirect, type V2_MetaFunction } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import { Edit, Trash } from "lucide-react";
import Container from "~/components/layout/container/container";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { categoryEntity } from "~/domain/category/category.entity.server";
import type { Category } from "~/domain/category/category.model.server";
import { cn } from "~/lib/utils";
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
        }

        await categoryEntity.update(values.id as string, category)
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

        <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {
                categoriesSorted.map(category => {
                    return (
                        <li key={category.id} className="flex items-center mb-4">
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
        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full h-[130px]`}>

            <SortingOrderItems enabled={action === "categories-sortorder"} itemId={category.id}>
                <Link to={`${category.id}`} >
                    <div className="flex flex-col gap-4 justify-between">
                        <h2 className="font-lg font-semibold tracking-tight">{category.name}</h2>
                        <Badge className={
                            cn(
                                "w-max",
                                category.type === "menu" ? "bg-brand-green" : "bg-brand-blue",
                            )
                        }>{category.type}</Badge>
                    </div>
                </Link>
            </SortingOrderItems>
        </div>
    )
}

