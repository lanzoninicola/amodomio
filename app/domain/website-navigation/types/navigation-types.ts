import { LucideIcon } from "lucide-react";

export interface NavigationLink {
  title: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
  icon?: LucideIcon | ((props: React.SVGProps<SVGSVGElement>) => JSX.Element);
  label?: string;
  highlight?: boolean;
}

export interface NavigationSection extends NavigationLink {
  items: NavigationSection[];
}

export interface MainNavigationLink extends NavigationLink {}

export interface SidebarNavigationSection extends NavigationSection {}

export interface WebsiteNavigationConfig {
  mainNav: MainNavigationLink[];
  sidebarNav: SidebarNavigationSection[];
}
