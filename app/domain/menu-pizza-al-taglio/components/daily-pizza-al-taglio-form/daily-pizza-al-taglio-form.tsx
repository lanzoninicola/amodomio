import { Form } from "@remix-run/react"
import { MenuPizzaAlTaglio } from "../../menu-pizza-al-taglio.model.server"
import InputItem from "~/components/primitives/form/input-item/input-item"

interface MenuPizzaAlTaglioFormProps {
    action: "category-create" | "category-update"
    menu?: MenuPizzaAlTaglio
}

export default function MenuPizzaAlTaglioForm({ action, menu }: MenuPizzaAlTaglioFormProps) {


    return (
        <Form method="post">
            <input type="hidden" name="id" value={menu?.id} />


            <InputItem type="date" name="date" defaultValue={menu?.date} />
        </Form>
    )




}