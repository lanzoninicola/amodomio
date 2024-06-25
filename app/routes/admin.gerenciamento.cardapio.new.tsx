import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";



export default function NewCardapioItem() {
    return <MenuItemForm action="menu-item-create" className="my-8 border rounded-xl p-4" />
}