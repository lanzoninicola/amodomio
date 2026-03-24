
import { Link, NavLink, useFetcher, useLocation, useNavigate, useRevalidator } from "@remix-run/react";
import { Globe, House, Loader2, Menu, Pin, PinOff, Search, Settings, Smartphone, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { toast } from "~/components/ui/use-toast";

type TopNavItem = {
    id: string;
    href: string;
    title: string;
    count: number;
    groupTitle?: string | null;
    pinned?: boolean;
};

interface AdminHeaderProps {
    urlSegment?: string
    slug?: string
    topNavItems?: TopNavItem[]
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


export function AdminHeader({ urlSegment, slug, topNavItems = [] }: AdminHeaderProps) {
    const [openingStatus, setOpeningStatus] = useState<StoreOpeningStatusResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [openSearch, setOpenSearch] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
        const onOpenNavSearch = () => {
            setOpenSearch(true);
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("admin:open-nav-search", onOpenNavSearch);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("admin:open-nav-search", onOpenNavSearch);
        };
    }, []);


    return (
        <>
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
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                    </div>
                    <nav className="flex items-center justify-center gap-3 lg:gap-4">
                        <button
                            type="button"
                            className="md:hidden flex flex-col items-center gap-0.5 hover:bg-slate-50 rounded-md p-2"
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="Abrir menu"
                        >
                            <Menu size={18} />
                            <span className="text-[10px] text-foreground/60">Menu</span>
                        </button>
                        <div className="hidden md:block">
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
                        </div>
                        <Link to={"/admin"}>
                            <div className="flex flex-col items-center gap-0.5 hover:bg-slate-50 rounded-md p-2">
                                <House size={18} />
                                <span className="text-[10px] lg:text-xs text-foreground/60 transition-colors hover:text-foreground/80">Início</span>
                            </div>
                        </Link>
                        <Link to={"/admin/administracao/settings"}>
                            <div className="flex flex-col items-center gap-0.5 hover:bg-slate-50 rounded-md p-2">
                                <Settings size={18} />
                                <span className="text-[10px] lg:text-xs text-foreground/60 transition-colors hover:text-foreground/80">Config</span>
                            </div>
                        </Link>
                        <Link to={"/cardapio"} prefetch="none" target="_blank">
                            <div className="flex flex-col items-center gap-0.5 hover:bg-slate-50 rounded-md p-2">
                                <Globe size={18} />
                                <span className="text-[10px] lg:text-xs text-foreground/60 transition-colors hover:text-foreground/80">Cardápio</span>
                            </div>
                        </Link>

                        <FastLinks topNavItems={topNavItems} />

                        <Link to={"/admin/mobile"} prefetch="none">
                            <div className="flex flex-col items-center gap-0.5 hover:bg-slate-50 rounded-md p-2">
                                <Smartphone size={18} color="blue" />
                                <span className="text-[10px] lg:text-xs transition-colors hover:text-foreground/80 text-blue-700">Mobile</span>
                            </div>
                        </Link>

                        {/* <ModeToggle /> */}
                    </nav>
                </div>
            </div>

            {/* Mobile store status banner */}
            <div className="md:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            disabled={!openingStatus}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide",
                                openingStatus?.isOpen
                                    ? "bg-emerald-500 text-white"
                                    : "bg-red-500 text-white"
                            )}
                        >
                            <span className="h-2 w-2 rounded-full bg-white/80" />
                            {statusLabel}
                            {isManual && (
                                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                                    manual
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-56">
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
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        </>
    )
}

function FastLinks({ topNavItems }: { topNavItems: TopNavItem[] }) {
    const fetcher = useFetcher();
    const revalidator = useRevalidator();
    const pendingPinRequestIdRef = useRef<string | null>(null);
    const pendingPinPrevPinnedRef = useRef<boolean | null>(null);
    const [pendingPinHref, setPendingPinHref] = useState<string | null>(null);
    const [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (fetcher.state !== "idle") return;
        if (!pendingPinRequestIdRef.current) return;
        const response = fetcher.data as {
            status?: number;
            message?: string;
            payload?: { requestId?: string; pinned?: boolean };
        } | undefined;
        const responseRequestId = response?.payload?.requestId ?? "";
        if (responseRequestId !== pendingPinRequestIdRef.current) return;

        if (response?.status && response.status >= 400) {
            if (pendingPinHref && pendingPinPrevPinnedRef.current !== null) {
                setPinOverrides((prev) => ({
                    ...prev,
                    [pendingPinHref]: Boolean(pendingPinPrevPinnedRef.current),
                }));
            }
            toast({
                title: "Erro ao atualizar fixado",
                description: response.message || "Não foi possível fixar/desfixar o link.",
            });
            pendingPinRequestIdRef.current = null;
            pendingPinPrevPinnedRef.current = null;
            setPendingPinHref(null);
            return;
        }

        const pinned = Boolean(response?.payload?.pinned);
        toast({
            title: pinned ? "Link fixado" : "Link desfixado",
            description: pinned
                ? "Atalho adicionado aos fixados."
                : "Atalho removido dos fixados.",
        });

        pendingPinRequestIdRef.current = null;
        pendingPinPrevPinnedRef.current = null;
        setPendingPinHref(null);
        revalidator.revalidate();
    }, [fetcher.state, fetcher.data, pendingPinHref, revalidator]);

    const topNavWithOverrides = topNavItems.map((item) => ({
        ...item,
        pinned: pinOverrides[item.href] ?? Boolean(item.pinned),
    }));
    const topNavUnpinned = topNavWithOverrides.filter((item) => item.pinned !== true);
    const hasAny = topNavUnpinned.length > 0;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex flex-col items-center gap-0.5 hover:bg-slate-50 rounded-md p-2 cursor-pointer">
                    <Zap className="h-[18px] w-[18px]" />
                    <span className="text-[10px] lg:text-xs text-foreground/60 transition-colors hover:text-foreground/80">Atalhos</span>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1">
                {!hasAny ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Sem dados de navegação ainda.</p>
                ) : (
                    topNavUnpinned.map((navItem) => {
                        const isPinned = Boolean(navItem.pinned);
                        const isSubmittingCurrentPin = fetcher.state !== "idle" && pendingPinHref === navItem.href;
                        return (
                            <div key={navItem.id} className="flex items-center gap-1 rounded-md hover:bg-slate-50">
                                <Link
                                    to={navItem.href}
                                    className="flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5"
                                >
                                    <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                    <span className="flex-1 truncate text-sm text-slate-800">{navItem.title}</span>
                                    <span className="shrink-0 text-[10px] text-slate-400">{navItem.count}×</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const requestId = `${Date.now()}-${navItem.href}`;
                                        pendingPinRequestIdRef.current = requestId;
                                        pendingPinPrevPinnedRef.current = isPinned;
                                        setPendingPinHref(navItem.href);
                                        setPinOverrides((prev) => ({ ...prev, [navItem.href]: !isPinned }));
                                        fetcher.submit(
                                            {
                                                href: navItem.href,
                                                title: navItem.title,
                                                groupTitle: navItem.groupTitle ?? "",
                                                pinned: isPinned ? "false" : "true",
                                                requestId,
                                            },
                                            { method: "post", action: "/api/admin-nav-pin" }
                                        );
                                    }}
                                    disabled={isSubmittingCurrentPin}
                                    className="mr-1 shrink-0 rounded p-1 text-slate-300 transition hover:text-amber-500 disabled:opacity-50"
                                    aria-label={isPinned ? "Desfixar link" : "Fixar link"}
                                >
                                    {isSubmittingCurrentPin ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : isPinned ? (
                                        <PinOff className="h-3.5 w-3.5" />
                                    ) : (
                                        <Pin className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </div>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const location = useLocation();
    const initialPathRef = useRef(location.pathname);

    useEffect(() => {
        if (location.pathname !== initialPathRef.current) {
            onClose();
        }
    }, [location.pathname, onClose]);

    const renderItem = (item: SidebarNavigationSection, groupTitle: string) => {
        if (item.disabled) return null;

        if (!item.href && item.items?.length) {
            return (
                <div key={`${groupTitle}-${item.title}-group`}>
                    <p className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        {item.title}
                    </p>
                    {(item.items as SidebarNavigationSection[])
                        .filter((sub) => !sub.disabled && sub.href)
                        .map((sub) => (
                            <NavLink
                                key={sub.href}
                                to={sub.href!}
                                end={sub.href === "/admin"}
                                prefetch="none"
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-2 rounded-lg px-5 py-2 text-sm",
                                        isActive ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600"
                                    )
                                }
                            >
                                {sub.icon && <sub.icon size={14} />}
                                {sub.title}
                            </NavLink>
                        ))}
                </div>
            );
        }

        if (item.href) {
            return (
                <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === "/admin"}
                    prefetch="none"
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                            isActive ? "bg-slate-100 text-slate-900" : "text-slate-700"
                        )
                    }
                >
                    {item.icon && <item.icon size={15} />}
                    {item.title}
                </NavLink>
            );
        }

        return null;
    };

    return (
        <div
            className={cn(
                "fixed inset-0 z-[200] flex flex-col bg-white transition-all duration-300 ease-in-out",
                isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"
            )}
            aria-hidden={!isOpen}
        >
            <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="text-base font-semibold text-slate-900">Menu</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    aria-label="Fechar menu"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {ADMIN_NAVIGATION_LINKS.sidebarNav?.map((group) => (
                    <div key={group.title} className="mb-5">
                        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                            {group.title}
                        </p>
                        <div className="space-y-0.5">
                            {(group.items as SidebarNavigationSection[]).map((item) =>
                                renderItem(item, group.title)
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
