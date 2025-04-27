import { LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
  icon?: LucideIcon | ((props: React.SVGProps<SVGSVGElement>) => JSX.Element);
  label?: string;
  highlight?: boolean;
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface MainNavItem extends NavItem {}

export interface SidebarNavItem extends NavItemWithChildren {}

export interface WebsiteNavigationLinks {
  mainNav: MainNavItem[];
  sidebarNav: SidebarNavItem[];
}
