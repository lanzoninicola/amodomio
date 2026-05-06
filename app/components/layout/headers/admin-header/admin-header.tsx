import { User2 } from "lucide-react";
import Navbar from "~/components/primitives/navbar/navbar";


// catalogo => itens, categorias, unidades de medida
// cadastros => itens, receitas e fornecedores


const navLinks = [
    { label: "Iniçio", href: "/admin" },
    { label: "Cardápio", href: "/admin/menu" },
    { label: "Catálogos", href: "/admin/catalogs" },
    { label: "Itens", href: "/admin/items" },
    { label: "Receitas", href: "/admin/recipes" },
    { label: "Fornecedores", href: "/admin/suppliers" },
    { label: "Categorias", href: "/admin/categories" },
    { label: "Tamanhos", href: "/admin/sizes" },
]


export default function AdminHeader() {
    return (
        <header className="relative flex justify-end items-center w-full h-[85px] px-4 gap-4 md:gap-8 border-b-2 border-muted mb-4">
            <div className="absolute top-3 left-4">
                {/* <LogoTransparent /> */}
            </div>

            {/* <NavMenuLarge links={navLinks} /> */}
            <Navbar links={navLinks} />
            <User2 size={28} />


        </header>
    )
}
