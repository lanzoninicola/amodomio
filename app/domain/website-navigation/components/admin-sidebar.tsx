import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { SidebarNavigationSection, WebsiteNavigationConfig } from "../types/navigation-types";
import { NavLink, useFetcher, useRevalidator } from "@remix-run/react";
import { cn } from "~/lib/utils";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pin, Search } from "lucide-react";
import { toast } from "~/components/ui/use-toast";

export interface AdminSidebarProps {
  navigationLinks: Partial<WebsiteNavigationConfig>;
  pinnedHrefs?: string[];
  pinnedItems?: { href: string; title: string; groupTitle?: string | null }[];
  className?: string;
  children?: React.ReactNode;
}

export function AdminSidebar({ navigationLinks, pinnedHrefs, pinnedItems = [] }: AdminSidebarProps) {
  const navClickFetcher = useFetcher();
  const pinFetcher = useFetcher();
  const revalidator = useRevalidator();
  const [showPins, setShowPins] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingPinIntentRef = useRef<{
    href: string;
    targetPinned: boolean;
    requestId: string;
  } | null>(null);
  const pinnedSet = useMemo(() => new Set(pinnedHrefs ?? []), [pinnedHrefs]);

  useEffect(() => {
    if (pinFetcher.state !== "idle") return;
    if (!pendingPinIntentRef.current) return;

    const response = pinFetcher.data as {
      status?: number;
      message?: string;
      payload?: { href?: string; pinned?: boolean; requestId?: string };
    };
    const responseRequestId = String(response?.payload?.requestId ?? "");
    if (responseRequestId !== pendingPinIntentRef.current.requestId) return;

    const fallbackPinned = pendingPinIntentRef.current.targetPinned;
    const pinned = response?.payload?.pinned ?? fallbackPinned;
    setPendingHref(null);
    pendingPinIntentRef.current = null;

    if (response?.status && response.status >= 400) {
      toast({
        title: "Erro ao atualizar pin",
        description: response.message || "Nao foi possivel fixar/desfixar o link.",
      });
      return;
    }

    revalidator.revalidate();

    toast({
      title: pinned ? "Link fixado" : "Link desfixado",
      description: pinned ? "Atalho adicionado aos fixados." : "Atalho removido dos fixados.",
    });
  }, [pinFetcher.state, pinFetcher.data, revalidator]);

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

  const submitPin = (payload: {
    href: string;
    title: string;
    groupTitle: string;
    pinned: boolean;
  }) => {
    const requestId = `${Date.now()}-${payload.href}`;
    setPendingHref(payload.href);
    pendingPinIntentRef.current = {
      href: payload.href,
      targetPinned: payload.pinned,
      requestId,
    };
    pinFetcher.submit(
      {
        href: payload.href,
        title: payload.title,
        groupTitle: payload.groupTitle,
        pinned: payload.pinned ? "true" : "false",
        requestId,
      },
      { method: "post", action: "/api/admin-nav-pin" }
    );
  };

  const renderSubItems = (items: SidebarNavigationSection[], groupTitle: string) => (
    <SidebarMenuSub className="!mx-2.5 !gap-0.5 !px-2 !py-0.5">
      {items
        .filter((item) => item.disabled === false)
        .map((item) => (
          <SidebarMenuSubItem key={`${groupTitle}-${item.title}-${item.href ?? "no-link"}-sub`}>
            <SidebarMenuSubButton asChild size="sm" className="h-[24px] px-0.5">
              {item.href ? (
                <div className="flex w-full items-center gap-1">
                  {showPins ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition",
                        pinnedSet.has(item.href) ? "text-amber-600" : "text-slate-400 hover:text-slate-700"
                      )}
                      disabled={pendingHref === item.href && pinFetcher.state !== "idle"}
                      aria-label={pinnedSet.has(item.href) ? `Desfixar ${item.title}` : `Fixar ${item.title}`}
                      title={pinnedSet.has(item.href) ? "Desfixar" : "Fixar"}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        submitPin({
                          href: item.href,
                          title: item.title,
                          groupTitle,
                          pinned: !pinnedSet.has(item.href),
                        });
                      }}
                    >
                      {pendingHref === item.href && pinFetcher.state !== "idle" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Pin size={12} />
                      )}
                    </button>
                  ) : null}
                  <NavLink
                    to={item.href}
                    end={item.href === "/admin"}
                    prefetch="none"
                    onClick={() =>
                      trackNavClick({
                        href: item.href,
                        title: item.title,
                        groupTitle,
                      })
                    }
                    className={({ isActive }) =>
                      cn(
                        "flex w-full items-center rounded-md px-2 py-1 text-[0.76rem] font-medium transition",
                        isActive ? "bg-slate-100 text-slate-900" : "text-slate-900 hover:bg-slate-100/80"
                      )
                    }
                    title={item.title}
                  >
                    {item.icon && <item.icon size={14} />}
                    <span className={cn("truncate", item.highlight && "font-semibold")}>{item.title}</span>
                  </NavLink>
                </div>
              ) : (
                <span className="flex min-w-0 items-center gap-2 px-2 py-1 text-[0.76rem] text-slate-900" title={item.title}>
                  {item.icon && <item.icon size={14} />}
                  <span className={cn("truncate", item.highlight && "font-semibold")}>{item.title}</span>
                </span>
              )}
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        ))}
    </SidebarMenuSub>
  );

  const renderSidebarItems = (items: SidebarNavigationSection[], groupTitle: string) =>
    items
      .filter((item) => item.disabled === false)
      .map((item) => (
        <SidebarMenuItem key={`${groupTitle}-${item.title}-${item.href ?? "no-link"}`}>
          <SidebarMenuButton asChild className="h-[30px] px-1">
            {item.href ? (
              <div className="flex w-full items-center gap-1">
                {showPins ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition",
                      pinnedSet.has(item.href) ? "text-amber-600" : "text-slate-400 hover:text-slate-700"
                    )}
                    disabled={pendingHref === item.href && pinFetcher.state !== "idle"}
                    aria-label={pinnedSet.has(item.href) ? `Desfixar ${item.title}` : `Fixar ${item.title}`}
                    title={pinnedSet.has(item.href) ? "Desfixar" : "Fixar"}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      submitPin({
                        href: item.href,
                        title: item.title,
                        groupTitle,
                        pinned: !pinnedSet.has(item.href),
                      });
                    }}
                  >
                    {pendingHref === item.href && pinFetcher.state !== "idle" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Pin size={12} />
                    )}
                  </button>
                ) : null}
                <NavLink
                  to={item.href}
                  end={item.href === "/admin"}
                  prefetch="none"
                  className={({ isActive }) =>
                    cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[0.76rem] font-medium transition",
                      isActive ? "bg-slate-100 text-slate-900" : "text-slate-900 hover:bg-slate-100/80"
                    )
                  }
                  onClick={() =>
                    trackNavClick({
                      href: item.href,
                      title: item.title,
                      groupTitle,
                    })
                  }
                  title={item.title}
                >
                  {item.icon && <item.icon size={15} />}
                  <span className={cn("truncate", item.highlight && "font-semibold")}>{item.title}</span>
                </NavLink>
              </div>
            ) : (
              <span className="flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-[0.76rem] text-slate-900" title={item.title}>
                {item.icon && <item.icon size={15} />}
                <span className={cn("truncate", item.highlight && "font-semibold")}>{item.title}</span>
              </span>
            )}
          </SidebarMenuButton>
          {item.items?.length ? renderSubItems(item.items, groupTitle) : null}
        </SidebarMenuItem>
      ));

  return (
    <Sidebar
      variant="sidebar"
      className="!top-[calc(var(--header-height,3.5rem)+0.6rem)] !h-[calc(100svh-5rem)] bg-white [&_[data-sidebar=sidebar]]:bg-white"
      style={{ "--sidebar-width": "16rem" } as CSSProperties}
    >
      <div className="relative flex h-full min-h-0 w-full flex-col">
        <SidebarHeader className="mx-auto w-[14.5rem] px-2 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("admin:open-nav-search"))}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 transition hover:bg-slate-100"
              aria-label="Buscar item de menu"
            >
              <Search size={12} />
              Buscar
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition",
                showPins
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
              onClick={() => setShowPins((curr) => !curr)}
              aria-pressed={showPins}
            >
              <Pin size={12} />
              {showPins ? "Fixando" : "Fixar"}
            </button>
          </div>
        </SidebarHeader>
        <SidebarContent className="mx-auto h-full min-h-0 w-[14.5rem] overflow-y-auto overflow-x-hidden px-2 pt-4 pb-10 font-sans [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.35)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/35 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/55">
          {navigationLinks?.sidebarNav?.map((group: SidebarNavigationSection) => {
            const dynamicPinnedItems =
              group.title === "Fixados" && pinnedItems.length > 0
                ? pinnedItems.map((p) => ({
                    title: p.title,
                    href: p.href,
                    items: [] as SidebarNavigationSection[],
                    disabled: false,
                  }))
                : [];
            return (
              <SidebarGroup key={group.title} className="w-full px-0.5 py-4">
                <SidebarGroupLabel className="px-2 text-[0.78rem] font-medium text-muted-foreground">{group.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {renderSidebarItems(group.items, group.title)}
                    {renderSidebarItems(dynamicPinnedItems, group.title)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
