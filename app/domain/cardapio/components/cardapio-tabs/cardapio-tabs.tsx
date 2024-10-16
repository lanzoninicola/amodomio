import { Link, useLocation } from "@remix-run/react"
import { LayoutTemplate, LayoutList } from "lucide-react"
import { cn } from "~/lib/utils"

export default function CardapioTabs() {
    const location = useLocation()

    const cnActiveTab = "bg-muted rounded-md p-2"

    return (
        <div className="flex gap-4 justify-center mb-2">
            <Link to={"/cardapio"} className={
                cn(
                    "p-2",
                    location.pathname === "/cardapio" && cnActiveTab,

                )
            } >
                <div className="flex flex-col justify-center items-center gap-1">
                    <LayoutTemplate />
                    {location.pathname === "/cardapio" && <div className="rounded-lg w-3 h-1 bg-black"></div>}
                </div>
            </Link>
            <Link to={"/cardapio/list"} className={
                cn(
                    "p-2",
                    location.pathname === "/cardapio/list" && cnActiveTab,

                )
            } >
                <div className="flex flex-col justify-center items-center gap-1">
                    <LayoutList />
                    {location.pathname === "/cardapio/list" && <div className="rounded-lg w-3 h-1 bg-black"></div>}
                </div>
            </Link>
        </div>
    )
}