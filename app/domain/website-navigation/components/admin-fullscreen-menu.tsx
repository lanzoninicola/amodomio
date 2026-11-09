import { NavLink, useFetcher } from "@remix-run/react";
import { Menu, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "~/lib/utils";
import type { SidebarNavigationSection, WebsiteNavigationConfig } from "../types/navigation-types";

export interface AdminFullscreenMenuProps {
  navigationLinks: Partial<WebsiteNavigationConfig>;
  pinnedItems?: { href: string; title: string; groupTitle?: string | null }[];
}

export function AdminFullscreenMenu({ navigationLinks, pinnedItems = [] }: AdminFullscreenMenuProps) {
  const navClickFetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.key.toLowerCase() !== "m") return;

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const trackNavClick = (payload: { href?: string; title: string; groupTitle?: string }) => {
    if (!payload.href || payload.href === "/admin") return;

    navClickFetcher.submit(
      {
        href: payload.href,
        title: payload.title,
        groupTitle: payload.groupTitle || "",
      },
      { method: "post", action: "/api/admin-nav-click" }
    );
  };

  const sections = useMemo(() => {
    const baseSections =
      navigationLinks.sidebarNav?.map((group) =>
        group.title === "Fixados" && pinnedItems.length > 0
          ? {
            ...group,
            items: [
              ...group.items,
              ...pinnedItems.map((item) => ({
                title: item.title,
                href: item.href,
                items: [] as SidebarNavigationSection[],
                disabled: false,
              })),
            ],
          }
          : group
      ) ?? [];
    return filterSections(baseSections, searchQuery);
  }, [navigationLinks.sidebarNav, pinnedItems, searchQuery]);
  const fixedSection = sections.find((group) => group.title === "Fixados") ?? null;
  const otherSections = sections.filter((group) => group.title !== "Fixados");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="hidden md:inline-flex fixed left-3 top-2 z-[65] h-9 w-9 items-center justify-center rounded-full  text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          aria-label="Abrir menu administrativo"
        >
          <Menu className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="left-4 top-1/2 flex h-[min(86dvh,760px)] w-[calc(100dvw-2rem)] max-w-none translate-x-0 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0 font-sans shadow-xl md:w-[75dvw] [&>button]:right-4 [&>button]:top-4">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 pr-12 md:flex-row md:items-center md:justify-between md:px-5 md:pr-14">
          <DialogTitle className="text-base font-semibold text-slate-950">Menu administrativo</DialogTitle>
          <DialogDescription className="sr-only">Menu principal do painel administrativo.</DialogDescription>
          <div className="relative w-full max-w-sm md:ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar item do menu"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-[0.78rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-rows-[auto_1fr] md:grid-cols-[11rem_1fr] md:grid-rows-1">
            <aside className="border-b border-slate-200 px-4 py-3 md:border-b-0 md:border-r md:px-3">
              {fixedSection ? (
                <MenuSection
                  group={fixedSection}
                  onNavigate={(payload) => {
                    trackNavClick(payload);
                    setOpen(false);
                  }}
                />
              ) : null}
            </aside>

            <div className="min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3 [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.35)_transparent] md:px-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/35 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/55">
              <div className="grid gap-x-5 gap-y-0.5 md:grid-cols-4">
                {otherSections.map((group) => (
                  <MenuSection
                    key={group.title}
                    group={group}
                    onNavigate={(payload) => {
                      trackNavClick(payload);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </nav>
      </DialogContent>
    </Dialog>
  );
}

function MenuSection({
  group,
  onNavigate,
}: {
  group: SidebarNavigationSection;
  onNavigate: (payload: { href?: string; title: string; groupTitle?: string }) => void;
}) {
  return (
    <section className="min-w-0 px-0.5 py-2">
      <h2 className="px-2 text-[0.92rem] font-semibold text-slate-950">{group.title}</h2>
      <div className="mt-0.5 space-y-px">
        {group.items
          .filter((item) => item.disabled === false)
          .map((item) => (
            <MenuEntry
              key={`${group.title}-${item.title}-${item.href ?? "no-link"}`}
              item={item}
              groupTitle={group.title}
              onNavigate={onNavigate}
            />
          ))}
      </div>
    </section>
  );
}

function MenuEntry({
  item,
  groupTitle,
  onNavigate,
}: {
  item: SidebarNavigationSection;
  groupTitle: string;
  onNavigate: (payload: { href?: string; title: string; groupTitle?: string }) => void;
}) {
  const Icon = item.icon;

  if (item.href) {
    return (
      <NavLink
        to={item.href}
        end={item.href === "/admin"}
        prefetch="none"
        onClick={() => onNavigate({ href: item.href, title: item.title, groupTitle })}
        className={({ isActive }) =>
          cn(
            "flex min-h-[22px] w-full items-center gap-2 rounded-md px-2.5 py-px text-[0.8rem] font-medium text-slate-900 transition hover:bg-slate-100/80",
            isActive && "bg-slate-100 text-slate-900",
            item.highlight && "font-semibold"
          )
        }
      >
        {Icon ? <Icon className="h-[15px] w-[15px] shrink-0" /> : null}
        <span className="min-w-0 truncate">{item.title}</span>
      </NavLink>
    );
  }

  return (
    <div className="space-y-px">
      <div className="flex min-h-[22px] items-center gap-2 px-2.5 py-px text-[0.8rem] text-slate-900">
        {Icon ? <Icon className="h-[15px] w-[15px] shrink-0" /> : null}
        <span className={cn("min-w-0 truncate", item.highlight && "font-semibold")}>{item.title}</span>
      </div>
      {item.items?.length ? (
        <div className="mx-3.5 grid translate-x-px gap-0 border-l border-slate-200 px-2.5 py-px">
          {item.items
            .filter((subItem) => subItem.disabled === false)
            .map((subItem) => (
              <MenuEntry
                key={`${groupTitle}-${item.title}-${subItem.title}-${subItem.href ?? "no-link"}`}
                item={subItem}
                groupTitle={groupTitle}
                onNavigate={onNavigate}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filterSections(sections: SidebarNavigationSection[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return sections;

  return sections
    .map((section) => {
      const sectionMatches = normalizeSearchValue(section.title).includes(normalizedQuery);
      const filteredItems = sectionMatches
        ? section.items.filter((item) => item.disabled === false)
        : filterItems(section.items, normalizedQuery);

      return {
        ...section,
        items: filteredItems,
      };
    })
    .filter((section) => section.items.length > 0);
}

function filterItems(items: SidebarNavigationSection[], normalizedQuery: string): SidebarNavigationSection[] {
  return items
    .filter((item) => item.disabled === false)
    .map((item) => {
      const itemMatches = normalizeSearchValue(item.title).includes(normalizedQuery);
      const filteredChildren = item.items?.length ? filterItems(item.items, normalizedQuery) : [];

      if (itemMatches) {
        return {
          ...item,
          items: item.items?.filter((child) => child.disabled === false) ?? [],
        };
      }

      if (filteredChildren.length > 0) {
        return {
          ...item,
          items: filteredChildren,
        };
      }

      return null;
    })
    .filter((item): item is SidebarNavigationSection => Boolean(item));
}
