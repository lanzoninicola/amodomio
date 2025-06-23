import { Link, Outlet, useLocation } from "@remix-run/react";
import { List, Columns, Printer, SquarePlus, CircleArrowOutUpRight, LucideIcon } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { lastUrlSegment } from "~/utils/url";

export default function AdminGerenciamentoCardapioMainListLayout() {

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    const PageMenu = ({ href, label, children }: {
        href: string,
        children?: React.ReactNode,
        label: string
    }) => {
        return (
            <Link to={href}
                className="flex flex-col gap-1 items-center hover:bg-slate-200 p-1 rounded-md">
                {children}
                <span className="text-[11px] font-semibold leading-[1.15] text-center">{label}</span>
            </Link>
        )
    }


    return (
        <div className="flex flex-col">
            <Separator className="my-2" />
            <div className="flex gap-2 md:grid md:grid-cols-12">
                <PageMenu href="/admin/gerenciamento/cardapio/new" label="Novo item">
                    <SquarePlus size={16} />
                </PageMenu>
                <PageMenu href="/admin/gerenciamento/cardapio/export-wall" label="Imprimir">
                    <Printer size={16} />
                </PageMenu>
                <PageMenu href="/admin/gerenciamento/cardapio/export" label="Exportar" >
                    <CircleArrowOutUpRight size={16} />
                </PageMenu>


            </div>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-x-4 mb-4">
                <Link to="/admin/gerenciamento/cardapio/main/list"
                    className="hover:bg-muted my-4"
                >
                    <div className={
                        cn(
                            "flex items-center gap-2 justify-center  py-1",
                            activeTab === "list" && "bg-muted font-semibold rounded-md "
                        )
                    }>
                        <List size={14} />
                        <span className="text-[14px] uppercase tracking-wider font-semibold">Lista</span>
                    </div>
                </Link>
                <Link to="/admin/gerenciamento/cardapio/main/cols"
                    className="hover:bg-muted my-4"
                >
                    <div className={
                        cn(
                            "flex items-center gap-2 justify-center py-1",
                            activeTab === "cols" && "bg-muted  font-semibold rounded-md "
                        )
                    }>
                        <Columns size={14} />
                        <span className="text-[14px]  uppercase tracking-wider font-semibold">Colunas</span>
                    </div>
                </Link>
            </div>
            <Outlet />
        </div>
    )
}
