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
} from "@/components/ui/sidebar"
import { SidebarNavigationSection, WebsiteNavigationConfig } from "../types/navigation-types";
import { Link, useFetcher } from "@remix-run/react";
import { cn } from "~/lib/utils";

export interface AdminSidebarProps {
  navigationLinks: Partial<WebsiteNavigationConfig>;
  className?: string;
  children?: React.ReactNode;
}

export function AdminSidebar({ navigationLinks }: AdminSidebarProps) {
  const fetcher = useFetcher();

  const trackNavClick = (payload: { href?: string; title: string; groupTitle?: string }) => {
    if (!payload.href || payload.href === "/admin") {
      return;
    }

    fetcher.submit(
      {
        href: payload.href,
        title: payload.title,
        groupTitle: payload.groupTitle || "",
      },
      { method: "post", action: "/api/admin-nav-click" }
    );
  };

  const renderSidebarItems = (
    items: SidebarNavigationSection[],
    groupTitle: string,
    depth = 0
  ) => {
    return items
      .filter((item) => item.disabled === false)
      .map((item) => (
        <SidebarMenuItem key={`${groupTitle}-${item.title}-${item.href ?? "no-link"}`}>
          <SidebarMenuButton asChild>
            {item.href ? (
              <Link
                to={item.href}
                prefetch="none"
                className={cn(
                  "flex gap-1",
                  depth === 0 && "text-sm",
                  depth > 0 && "pl-4 text-xs text-muted-foreground border-l border-muted"
                )}
                onClick={() =>
                  trackNavClick({
                    href: item.href,
                    title: item.title,
                    groupTitle,
                  })
                }
              >
                {item.icon && <item.icon size={15} />}
                <span className={cn(item.highlight && "font-semibold")}>
                  {item.title}
                </span>
              </Link>
            ) : (
              <span
                className={cn(
                  "flex gap-1",
                  depth === 0 && "text-sm",
                  depth > 0 && "pl-4 text-xs text-muted-foreground border-l border-muted"
                )}
              >
                {item.icon && <item.icon size={15} />}
                <span className={cn(item.highlight && "font-semibold")}>
                  {item.title}
                </span>
              </span>
            )}
          </SidebarMenuButton>
          {item.items?.length ? (
            <SidebarMenu className="mt-1">
              {renderSidebarItems(item.items, groupTitle, depth + 1)}
            </SidebarMenu>
          ) : null}
        </SidebarMenuItem>
      ));
  };

  return (
    <Sidebar variant="floating">
      <SidebarHeader />
      <SidebarContent>

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
