
import { Link, useFetcher, useNavigate } from "@remix-run/react";
import { Globe, Search, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "~/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import ADMIN_NAVIGATION_LINKS from "~/domain/website-navigation/links/admin-navigation";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandShortcut,
} from "~/components/ui/command";
import { SidebarNavigationSection } from "~/domain/website-navigation/types/navigation-types";


interface AdminHeaderProps {
    urlSegment?: string
    slug?: string
}

type StoreOpeningStatusResponse = {
    isOpen: boolean
    override?: "auto" | "open" | "closed"
    timestamp?: string
}

type SearchNavItem = {
    title: string;
    href: string;
    groupTitle: string;
    contextLabel?: string;
};

function flattenSearchItems(
    sections: SidebarNavigationSection[]
): SearchNavItem[] {
    const acc: SearchNavItem[] = [];

    const walk = (
        items: SidebarNavigationSection[],
        groupTitle: string,
        trail: string[] = []
    ) => {
        for (const item of items) {
            if (item.disabled === true) continue;
            const nextTrail = [...trail, item.title];

            if (item.href && item.href.trim().length > 0) {
                acc.push({
                    title: item.title,
                    href: item.href,
                    groupTitle,
                    contextLabel: trail.length > 0 ? trail.join(" / ") : undefined,
                });
            }

            if (item.items?.length) {
                walk(item.items as SidebarNavigationSection[], groupTitle, nextTrail);
            }
        }
    };

    for (const section of sections) {
        walk(section.items as SidebarNavigationSection[], section.title);
    }

    return acc;
}


export function AdminHeader({ urlSegment, slug }: AdminHeaderProps) {
    const [openingStatus, setOpeningStatus] = useState<StoreOpeningStatusResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [openSearch, setOpenSearch] = useState(false)
    const navigate = useNavigate();
    const navClickFetcher = useFetcher();

    const statusLabel = useMemo(() => {
        if (!openingStatus) return "carregando..."
        return openingStatus.isOpen ? "loja aberta" : "loja fechada"
    }, [openingStatus])

    const searchItemsByGroup = useMemo(() => {
        const flatItems = flattenSearchItems(ADMIN_NAVIGATION_LINKS.sidebarNav as SidebarNavigationSection[]);
        return flatItems.reduce<Record<string, SearchNavItem[]>>((acc, item) => {
            if (!acc[item.groupTitle]) {
                acc[item.groupTitle] = [];
            }
            acc[item.groupTitle].push(item);
            return acc;
        }, {});
    }, []);

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

    const trackNavClick = (payload: { href?: string; title: string; groupTitle?: string }) => {
        if (!payload.href || payload.href === "/admin") {
            return;
        }

        navClickFetcher.submit(
            {
                href: payload.href,
                title: payload.title,
                groupTitle: payload.groupTitle || "",
            },
            { method: "post", action: "/api/admin-nav-click" }
        );
    };

    useEffect(() => {
        refreshStatus()
    }, [])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpenSearch((curr) => !curr);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);


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
                    navigationLinks={ADMIN_NAVIGATION_LINKS}
                    buttonTrigger={{
                        label: "Menu de navegação",
                    }}

                /> */}
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* <CommandMenu /> */}
                    </div>
                    <nav className="flex items-center justify-center gap-3 lg:gap-4">
                        <button
                            type="button"
                            onClick={() => setOpenSearch(true)}
                            className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm backdrop-blur-md transition hover:border-slate-300 hover:bg-white"
                            aria-label="Buscar item de menu"
                        >
                            <Search size={14} className="text-slate-500" />
                            <span>Buscar</span>
                            <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium tracking-normal text-slate-500 sm:inline-block">
                                ⌘K
                            </kbd>
                        </button>
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

            <CommandDialog
                open={openSearch}
                onOpenChange={setOpenSearch}
                title="Buscar no admin"
                description="Encontre páginas do menu de administração"
                className="max-w-2xl overflow-hidden border border-slate-200 bg-white/95 p-0 shadow-[0_30px_90px_rgba(15,23,42,0.20)] backdrop-blur-2xl [&_[data-slot=command-input-wrapper]]:mx-2 [&_[data-slot=command-input-wrapper]]:mt-2 [&_[data-slot=command-input-wrapper]]:rounded-lg [&_[data-slot=command-input-wrapper]]:border-b-0 [&_[data-slot=command-input-wrapper]]:border [&_[data-slot=command-input-wrapper]]:border-slate-200 [&_[data-slot=command-input-wrapper]]:bg-slate-50/80 [&_[data-slot=command-input-wrapper]]:px-3 [&_[data-slot=command-input-wrapper]]:focus-within:ring-2 [&_[data-slot=command-input-wrapper]]:focus-within:ring-slate-300 [&_[data-slot=command-input-wrapper]]:focus-within:ring-offset-2 [&_[data-slot=command-input-wrapper]]:focus-within:ring-offset-white"
            >
                <CommandInput
                    placeholder="Buscar item de menu..."
                    className="h-12 text-sm"
                />
                <CommandList className="max-h-[56vh]">
                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                    {Object.entries(searchItemsByGroup).map(([groupTitle, items]) => (
                        <CommandGroup key={groupTitle} heading={groupTitle}>
                            {items.map((item) => (
                                <CommandItem
                                    key={`${item.groupTitle}-${item.href}`}
                                    value={`${item.title} ${item.contextLabel ?? ""} ${item.href}`}
                                    onSelect={() => {
                                        setOpenSearch(false);
                                        trackNavClick({
                                            href: item.href,
                                            title: item.title,
                                            groupTitle: item.groupTitle,
                                        });
                                        navigate(item.href);
                                    }}
                                    className="rounded-md px-3 py-2"
                                >
                                    <div className="flex w-full min-w-0 items-center gap-3">
                                        <Search size={14} className="text-slate-400" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-slate-900">{item.title}</p>
                                            {item.contextLabel ? (
                                                <p className="truncate text-xs text-muted-foreground">{item.contextLabel}</p>
                                            ) : null}
                                        </div>
                                        <CommandShortcut className="max-w-[180px] truncate text-[10px] uppercase tracking-[0.14em]">
                                            {item.href}
                                        </CommandShortcut>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        </header>
    )
}
