import { Outlet } from "@remix-run/react";
import { PlusSquare } from "lucide-react";
import LinkButton from "~/components/primitives/table-list/action-buttons/link-button/link-button";


export default function RecipeSingleIngredients() {
    return (
        <div className="p-4">
            <div className="mb-4">
                <LinkButton to="new" label="Novo Ingrediente" labelClassName="uppercase font-semibold tracking-wider text-xs">
                    <PlusSquare size={16} />
                </LinkButton>
            </div>

            <Outlet ></Outlet>
        </div>
    )
}