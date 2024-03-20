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

export interface WebsiteNavigation {
  mainNav: MainNavItem[];
  sidebarNav: SidebarNavItem[];
}

export const WEBSITE_NAVIGATION_ITEMS: WebsiteNavigation = {
  mainNav: [
    {
      title: "Administração",
      href: "/admin",
    },
    {
      title: "Website",
      href: "/",
    },
  ],
  sidebarNav: [
    {
      title: "Gerenciamento",
      items: [
        {
          title: "Cardápio Delivery",
          href: "/admin/cardapio",
          items: [],
        },
        {
          title: "Cardápio Pizza Al Taglio",
          href: "/admin/cardapio-pizza-al-taglio",
          items: [],
          disabled: false,
        },
        {
          title: "Produtos",
          href: "/admin/products",
          items: [],
          disabled: false,
        },
        {
          title: "Categorias",
          href: "/admin/categorias",
          items: [],
          disabled: false,
        },
        {
          title: "Promo 'Fotos Cardapio'",
          href: "/admin/pizza-promo",
          items: [],
          disabled: false,
        },
        {
          title: "Opções",
          href: "/admin/options",
          items: [],
          disabled: true,
        },
      ],
    },
    {
      title: "Atendimento",
      items: [
        {
          title: "Cardápio",
          href: "/cardapio",
          items: [],
          disabled: true,
        },
        {
          title: "Pedidos",
          href: "/admin/daily-orders",
          items: [],
          disabled: false,
        },
        {
          title: "Linha do tempo Pedidos",
          href: "/admin/orders-delays-timeline-segmentation",
          items: [],
          disabled: true,
        },
        {
          title: "Linha do tempo Entrega",
          href: "/admin/orders-delivery-time-left",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Cozinha",
      items: [
        {
          title: "Lista de compras",
          href: "/admin/grocery-shopping-list",
          items: [],
          disabled: false,
        },
        {
          title: "Massa",
          href: "/admin/dough",
          items: [],
          disabled: false,
        },

        {
          title: "Pizza Al Taglio",
          href: "/admin/pizza-al-taglio",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Administração",
      disabled: true,
      items: [
        {
          title: "Usuários",
          href: "/admin/users",
          items: [],
          disabled: true,
        },
      ],
    },
  ],
};
