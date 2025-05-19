import GLOBAL_LINKS from "../global-links.constant";
import { WebsiteNavigationLinks } from "../website-navigation.type";
import { Shield } from "lucide-react";

const ADMIN_WEBSITE_NAVIGATION_ITEMS: WebsiteNavigationLinks = {
  mainNav: [GLOBAL_LINKS.admin, GLOBAL_LINKS.website],
  sidebarNav: [
    {
      title: "Iniçio",
      items: [
        {
          title: "Pagina Inicial",
          href: "/admin",
          items: [],
          disabled: false,
          highlight: true,
          icon: Shield,
        },
        {
          title: "Website",
          href: "/",
          items: [],
          disabled: true,
        },
      ],
    },
    {
      title: "Atendimento",
      items: [
        {
          title: "Gerenciamento Sabores",
          href: "/admin/atendimento/gerenciamento-sabores",
          items: [],
          disabled: false,
        },
        {
          title: "Assistente de Escolha",
          href: "/admin/atendimento/assistente-de-escolha",
          items: [],
          disabled: false,
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
      title: "Gerenciamento Cardápio",
      items: [
        {
          title: "Cardápio Delivery",
          href: "/admin/gerenciamento/cardapio/main/list",
          items: [],
          disabled: false,
        },
        {
          title: "Custos Itens",
          href: "/admin/gerenciamento/cardapio/cost-management",
          items: [],
          disabled: false,
        },
        {
          title: "Preços de Venda",
          href: "/admin/gerenciamento/cardapio/sell-price-management",
          items: [],
          disabled: false,
        },
        {
          title: "Cardápio Pizza Al Taglio",
          href: "/admin/gerenciamento/cardapio-pizza-al-taglio",
          items: [],
          disabled: false,
        },
        {
          title: "Promo 'Fotos Cardapio'",
          href: "/admin/gerenciamento/pizza-promo",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Produção",
      items: [
        {
          title: "Stock Massa",
          href: "/admin/gerenciamento/stock-massa-init",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Financeiro",
      items: [
        {
          title: "Custos itens cardápio delivery",
          href: "/admin/gerenciamento/cardapio-items-costs",
          items: [],
          disabled: false,
        },
        {
          title: "Fechamento do dia",
          href: "/admin/financeiro/fechamento-dia",
          items: [],
          disabled: false,
        },
        {
          title: "Importador",
          href: "/admin/financeiro/importer",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Cadastro",
      items: [
        {
          title: "Produtos",
          href: "/admin/products",
          items: [],
          disabled: false,
        },
        {
          title: "Receitas",
          href: "/admin/recipes",
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
          title: "Opções",
          href: "/admin/options",
          items: [],
          disabled: true,
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
      title: "HR",
      items: [
        {
          title: "Analise candidatos 'Auxiliar Cozinha'",
          href: "/admin/hr/analise/auxiliar-cozinha",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Administração",
      disabled: false,
      items: [
        {
          title: "Usuários",
          href: "/admin/users",
          items: [],
          disabled: true,
        },
        {
          title: "Import CSV",
          href: "/admin/importer",
          items: [],
          disabled: false,
        },
      ],
    },
  ],
};

export default ADMIN_WEBSITE_NAVIGATION_ITEMS;
