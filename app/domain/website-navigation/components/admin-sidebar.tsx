import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { SidebarNavigationSection, WebsiteNavigationConfig } from "../types/navigation-types";
import { Link, useFetcher, useRevalidator } from "@remix-run/react";
import { cn } from "~/lib/utils";
import { Loader2, Pin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "~/components/ui/use-toast";

export interface AdminSidebarProps {
  navigationLinks: Partial<WebsiteNavigationConfig>;
  pinnedHrefs?: string[];
  className?: string;
  children?: React.ReactNode;
}

export function AdminSidebar({ navigationLinks, pinnedHrefs }: AdminSidebarProps) {
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
        description: response.message || "Não foi possível fixar/desfixar o link.",
      });
      return;
    }

    revalidator.revalidate();

    toast({
      title: pinned ? "Link fixado" : "Link desfixado",
      description: pinned
        ? "Atalho adicionado aos fixados."
        : "Atalho removido dos fixados.",
    });
  }, [pinFetcher.state, pinFetcher.data]);

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
    <SidebarMenuSub className="gap-0.5 py-0">
      {items
        .filter((item) => item.disabled === false)
        .map((item) => (
          <SidebarMenuSubItem key={`${groupTitle}-${item.title}-${item.href ?? "no-link"}-sub`}>
            <SidebarMenuSubButton asChild size="sm" className="h-6 px-1.5">
              {item.href ? (
                <div className="flex w-full items-center gap-2">
                  {showPins ? (
                    <button
                      type="button"
                      className={cn(
                        "shrink-0",
                        pinnedSet.has(item.href) ? "text-amber-600" : "text-muted-foreground hover:text-slate-900"
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
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Pin size={14} />
                      )}
                    </button>
                  ) : null}
                  <Link
                    to={item.href}
                    prefetch="none"
                    onClick={() =>
                      trackNavClick({
                        href: item.href,
                        title: item.title,
                        groupTitle,
                      })
                    }
                    className="flex min-w-0 flex-1 items-center gap-2"
                    title={item.title}
                  >
                    {item.icon && <item.icon size={14} />}
                    <span className={cn("min-w-0 truncate whitespace-nowrap text-[12px]", item.highlight && "font-semibold")}>
                      {item.title}
                    </span>
                  </Link>
                </div>
              ) : (
                <span className="flex min-w-0 items-center gap-2" title={item.title}>
                  {item.icon && <item.icon size={14} />}
                  <span className={cn("min-w-0 truncate whitespace-nowrap text-[12px]", item.highlight && "font-semibold")}>
                    {item.title}
                  </span>
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
          <SidebarMenuButton asChild>
            {item.href ? (
              <div className="flex w-full items-center gap-2">
                {showPins ? (
                  <button
                    type="button"
                    className={cn(
                      "text-muted-foreground hover:text-slate-900",
                      pinnedSet.has(item.href) && "text-amber-600"
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
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Pin size={14} />
                    )}
                  </button>
                ) : null}
                <Link
                  to={item.href}
                  prefetch="none"
                  className="flex min-w-0 flex-1 items-center gap-2 text-sm"
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
                  <span className={cn("min-w-0 truncate whitespace-nowrap", item.highlight && "font-semibold")}>
                    {item.title}
                  </span>
                </Link>
              </div>
            ) : (
              <span className="flex min-w-0 items-center gap-2 text-sm" title={item.title}>
                {item.icon && <item.icon size={15} />}
                <span className={cn("min-w-0 truncate whitespace-nowrap", item.highlight && "font-semibold")}>
                  {item.title}
                </span>
              </span>
            )}
          </SidebarMenuButton>
          {item.items?.length ? renderSubItems(item.items, groupTitle) : null}
        </SidebarMenuItem>
      ));

  return (
    <Sidebar variant="floating">
      <SidebarHeader />
      <SidebarContent>
        <div className="px-3 pb-2">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
              showPins ? "border-amber-200 text-amber-700 bg-amber-50" : "border-muted text-muted-foreground hover:text-slate-900"
            )}
            onClick={() => setShowPins((curr) => !curr)}
            aria-pressed={showPins}
          >
            <Pin size={12} />
            <span>{showPins ? "Ocultar pins" : "Fixar links"}</span>
          </button>
        </div>

        {navigationLinks?.sidebarNav && navigationLinks.sidebarNav.map((group: SidebarNavigationSection) => (
          <SidebarGroup key={group.title} className="font-body">
            <SidebarGroupLabel className="font-semibold">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderSidebarItems(group.items, group.title)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>



        ))}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
