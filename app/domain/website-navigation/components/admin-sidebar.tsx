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
import { SidebarNavItem, WebsiteNavigationLinks } from "../website-navigation.type";
import { Link, useFetcher } from "@remix-run/react";
import { cn } from "~/lib/utils";

export interface AdminSidebarProps {
  navigationLinks: Partial<WebsiteNavigationLinks>;
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

  return (
    <Sidebar variant="floating">
      <SidebarHeader />
      <SidebarContent>

        {navigationLinks?.sidebarNav && navigationLinks.sidebarNav.map((group: SidebarNavItem) => (
          <SidebarGroup key={group.title} className="font-body">
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.filter(i => i.disabled === false)
                  .map((navItem) => (
                    <SidebarMenuItem key={navItem.title}>
                      <SidebarMenuButton asChild >
                        <Link
                          to={navItem.href || ""}
                          prefetch="none"
                          className="flex gap-1"
                          onClick={() => trackNavClick({ href: navItem.href, title: navItem.title, groupTitle: group.title })}
                        >
                          {navItem.icon && (
                            <navItem.icon size={15} />
                          )}
                          <span
                            className={cn(
                              navItem.highlight && "font-semibold"
                            )}
                          >
                            {navItem.title}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>



        ))}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
