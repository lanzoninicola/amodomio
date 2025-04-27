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
import MobileLink from "./mobile-link"
import { SidebarNavItem, WebsiteNavigationLinks } from "../website-navigation.type";
import React from "react";
import { Link } from "@remix-run/react";
import { cn } from "~/lib/utils";
import { Shield } from "lucide-react";

export interface AdminSidebarProps {
  navigationLinks: Partial<WebsiteNavigationLinks>;
  className?: string;
  children?: React.ReactNode;
}

export function AdminSidebar({ navigationLinks }: AdminSidebarProps) {
  return (
    <Sidebar variant="floating">
      <SidebarHeader />
      <SidebarContent>

        {navigationLinks?.sidebarNav && navigationLinks.sidebarNav.map((item: SidebarNavItem, index) => (
          <SidebarGroup key={item.title} className="font-body">
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.filter(i => i.disabled === false)
                  .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild >
                        <div className="flex gap-1">
                          {item.icon && (
                            <item.icon size={15} />
                          )}
                          <Link to={item.href || ""}>
                            <span className={
                              cn(
                                item.highlight && "font-semibold"
                              )
                            }>{item.title}</span>
                          </Link></div>

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

