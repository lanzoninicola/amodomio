import { Link, Outlet, useLocation } from "@remix-run/react";
import { List, Columns } from "lucide-react";
import { cn } from "~/lib/utils";
import { lastUrlSegment } from "~/utils/url";

export default function AdminGerenciamentoCardapioMainListLayout() {

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)


    return (
        <div className="flex flex-col">
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
