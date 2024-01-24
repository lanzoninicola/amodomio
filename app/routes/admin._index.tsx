import AppMenu, { NavItem } from "~/components/app-menu/app-menu";
import Container from "~/components/layout/container/container";


const navItems: NavItem[] = [
    { group: "administração", label: "Gerençiar cardápio", to: "/admin/cardapio" },
    { group: "atendimento", label: "Cardápio", to: "/cardapio" },
    { group: "administração", label: "Produtos", to: "/admin/products" },
    { group: "administração", label: "Categorias", to: "/admin/categorias" },
    { group: "cozinha", label: "Lista de supermercado", to: "/admin/grocery-list" },
    { group: "atendimento", label: "Pedidos", to: "/admin/daily-orders" },
    { group: "atendimento", label: "Linha do tempo Pedidos", to: "/admin/orders-delays-timeline-segmentation" },
    { group: "atendimento", label: "Linha do tempo Entrega", to: "/admin/orders-delivery-time-left" },
    { group: "cozinha", label: "Massa", to: "/admin/dough" },
    { group: "administração", label: "Opções", to: "/admin/options" },
]


export default function AdminIndex() {

    return (
        <Container>
            <div>Menu</div>
            <AppMenu navItems={navItems} />
        </Container>
    )
}