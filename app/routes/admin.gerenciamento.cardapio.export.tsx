import { Link, Outlet, useLocation } from "@remix-run/react";
import { List } from "lucide-react";
import { Button } from "~/components/ui/button";

import { cn } from "~/lib/utils";
import { lastUrlSegment } from "~/utils/url";


export default function CardapioExport() {

    const location = useLocation()
    const activeTab = lastUrlSegment(location.pathname)

    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-x-4 mb-4">
                <Link to="/admin/gerenciamento/cardapio/export/basic-list"
                    className="hover:bg-muted my-4"
                >
                    <div className={
                        cn(
                            "flex items-center gap-2 justify-center  py-1",
                            activeTab === "basic-list" && "bg-muted font-semibold rounded-md "
                        )
                    }>
                        <List size={14} />
                        <span className="text-[14px] uppercase tracking-wider font-semibold">Lista basica</span>
                    </div>
                </Link>
                <Link to="/admin/gerenciamento/cardapio/export/menu-items-price-variations"
                    className="hover:bg-muted my-4"
                >
                    <div className={
                        cn(
                            "flex items-center gap-2 justify-center  py-1",
                            activeTab === "menu-items-price-variations" && "bg-muted font-semibold rounded-md "
                        )
                    }>
                        <List size={14} />
                        <span className="text-[14px] uppercase tracking-wider font-semibold">Preços de venda</span>
                    </div>
                </Link>



            </div>

            <Outlet />
        </div>
    )
}