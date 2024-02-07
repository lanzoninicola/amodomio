import AppMenu, { NavItem } from "~/components/app-menu/app-menu";
import Container from "~/components/layout/container/container";


const navItems: NavItem[] = [
    { group: "administração", label: "Gerençiar cardápio", to: "/admin/cardapio", disabled: false },
    { group: "atendimento", label: "Cardápio", to: "/cardapio", disabled: true },
    { group: "administração", label: "Produtos", to: "/admin/products", disabled: false },
    { group: "administração", label: "Categorias", to: "/admin/categorias", disabled: false },
    { group: "cozinha", label: "Lista de compras", to: "/admin/grocery-shopping-list", disabled: false },
    { group: "atendimento", label: "Pedidos", to: "/admin/daily-orders", disabled: false },
    { group: "atendimento", label: "Linha do tempo Pedidos", to: "/admin/orders-delays-timeline-segmentation", disabled: true },
    { group: "atendimento", label: "Linha do tempo Entrega", to: "/admin/orders-delivery-time-left", disabled: false },
    { group: "cozinha", label: "Massa", to: "/admin/dough", disabled: false },
    { group: "administração", label: "Opções", to: "/admin/options", disabled: true },
    { group: "cozinha", label: "Usuários", to: "/admin/users", disabled: true },
]


export default function AdminIndex() {

    return (
        <Container>
            <div>Menu</div>
            <AppMenu navItems={navItems} />
        </Container>
    )
}