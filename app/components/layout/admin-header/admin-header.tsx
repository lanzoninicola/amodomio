
import { Link } from "@remix-run/react";
import { Globe, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "~/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";


interface AdminHeaderProps {
    urlSegment?: string
    slug?: string
}

type StoreOpeningStatusResponse = {
    isOpen: boolean
    override?: "auto" | "open" | "closed"
    timestamp?: string
}


export function AdminHeader({ urlSegment, slug }: AdminHeaderProps) {
    const [openingStatus, setOpeningStatus] = useState<StoreOpeningStatusResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const statusLabel = useMemo(() => {
        if (!openingStatus) return "carregando..."
        return openingStatus.isOpen ? "loja aberta" : "loja fechada"
    }, [openingStatus])

    const statusDot = openingStatus?.isOpen ? "bg-emerald-500" : "bg-red-500"
    const isManual = openingStatus?.override && openingStatus.override !== "auto"

    const refreshStatus = async () => {
        try {
            const response = await fetch("/api/store-opening-status")
            if (!response.ok) return
            const data = await response.json()
            setOpeningStatus(data)
        } catch {
            setOpeningStatus(null)
        }
    }

    const updateOverride = async (override: "auto" | "open" | "closed") => {
        setIsLoading(true)
        try {
            const body = new URLSearchParams({ override })
            const response = await fetch("/api/store-opening-status", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            })
            if (response.ok) {
                await refreshStatus()
            }
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        refreshStatus()
    }, [])


    return (
        <header className={
            cn(
                "sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                slug === "orders-delivery-time-left" && "hidden",
                slug === "export-wall" && "hidden",
                slug === "export-wall-two" && "hidden",
                slug === "atendimento" && "hidden",
                urlSegment?.includes("admin/kds/atendimento") && "hidden",
                urlSegment?.includes("admin/kds/cozinha") && "hidden"

            )
        }>
            <div className="container flex h-14 max-w-screen-2xl items-center">
                {/* <WebsiteNavigationSidebar
                    homeLink={{ label: "Iniçio", to: "admin" }}
                    navigationLinks={ADMIN_WEBSITE_NAVIGATION_ITEMS}
                    buttonTrigger={{
                        label: "Menu de navegação",
                    }}

                /> */}
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* <CommandMenu /> */}
                    </div>
                    <nav className="flex items-center justify-center gap-3 lg:gap-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2 rounded-full px-3 text-xs uppercase tracking-wide"
                                    disabled={!openingStatus}
                                >
                                    <span className={cn("h-2 w-2 rounded-full", statusDot)} />
                                    {statusLabel}
                                    {isManual && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                                            manual
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <div className="px-2 pb-2 text-xs text-muted-foreground">
                                    {openingStatus?.isOpen ? "Recebendo pedidos" : "Nao recebendo pedidos"}
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => updateOverride("open")} disabled={isLoading}>
                                    Abrir loja
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => updateOverride("closed")} disabled={isLoading}>
                                    Fechar loja
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => updateOverride("auto")} disabled={isLoading}>
                                    Voltar ao automatico
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link to={"/admin"}>
                            <div className="flex gap-2 items-center hover:bg-slate-50 rounded-md p-2">
                                <Shield />
                                <span className="hidden text-foreground/60 transition-colors hover:text-foreground/80 lg:block">Pagina Iniçial</span>
                            </div>
                        </Link>
                        <Link to={"/"} prefetch="none">
                            <div className="flex gap-2 items-center hover:bg-slate-50 rounded-md p-2">
                                <Globe />
                                <span className="hidden text-foreground/60 transition-colors hover:text-foreground/80 lg:block">Website</span>
                            </div>
                        </Link>

                        {/* <ModeToggle /> */}
                    </nav>
                </div>
            </div>
        </header>
    )
}
