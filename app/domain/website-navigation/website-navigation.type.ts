import { Icons } from "~/components/primitives/icons/icons";

export interface NavItem {
  title: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
  icon?: keyof typeof Icons;
  label?: string;
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
