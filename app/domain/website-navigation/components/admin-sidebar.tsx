import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar"
import MobileLink from "./mobile-link"
import { SidebarNavItem, WebsiteNavigationLinks } from "../website-navigation.type";
import React from "react";

export interface AdminSidebarProps {
  navigationLinks: Partial<WebsiteNavigationLinks>;
  className?: string;
  children?: React.ReactNode;
}

export function AdminSidebar({ navigationLinks }: AdminSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>

        {navigationLinks?.sidebarNav && navigationLinks.sidebarNav.map((item: SidebarNavItem, index) => (
          <SidebarGroup key={item.title} className="font-body">
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>



        ))}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}

