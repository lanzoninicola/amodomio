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
          title: "KDS",
          href: "/admin/kds/atendimento",
          items: [],
          disabled: false,
        },
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
        {
          title: "Comentarios clientes",
          href: "/admin/atendimento/comentarios",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Gerenciamento Cardápio",
      items: [
        {
          title: "Configurações",
          href: "/admin/gerenciamento/cardapio-settings",
          items: [],
          disabled: false,
        },
        {
          title: "Grupos",
          href: "/admin/gerenciamento/cardapio/groups",
          items: [],
          disabled: false,
        },
        {
          title: "Cardápio Delivery",
          href: "/admin/gerenciamento/cardapio/main/list",
          items: [],
          disabled: false,
        },
        {
          title: "Custo Ficha Tecnica",
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
          title: "Programação Diaria",
          href: "/admin/producao/progamacao-diaria",
          items: [],
          disabled: false,
        },
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
          title: "DNA",
          href: "/admin/financeiro/dna",
          items: [],
          disabled: false,
        },
        {
          title: "Resumo financeiro",
          href: "/admin/financeiro/resumo-financeiro",
          items: [],
          disabled: false,
        },
        {
          title: "Metas financeiras",
          href: "/admin/financeiro/metas",
          items: [],
          disabled: false,
        },
        {
          title: "Fechamento mensal",
          href: "/admin/financeiro/fechamento-mensal",
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
          title: "KDS",
          href: "/admin/kds/cozinha",
          items: [],
          disabled: false,
        },
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
      title: "RH",
      items: [
        {
          title: "Lista de vagas",
          href: "/admin/hr/job-openings",
          items: [],
          disabled: false,
        },
        {
          title: "Lista de candidaturas recebidas",
          href: "/admin/hr/applications",
          items: [],
          disabled: false,
        },
        {
          title: "Analise candidatos 'Auxiliar Cozinha'",
          href: "/admin/hr/analise/auxiliar-cozinha",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "BOT",
      disabled: false,
      items: [
        {
          title: "Debug page",
          href: "/admin/wpp",
          items: [],
          disabled: false,
        },
        {
          title: "Auto Responder",
          href: "/admin/wpp/auto-responder",
          items: [],
          disabled: false,
        },
        {
          title: "Configurar Auto Responder",
          href: "/admin/wpp/auto-responder/settings",
          items: [],
          disabled: false,
        },
        {
          title: "NLP",
          href: "/admin/nlp",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Clientes Inativos",
      disabled: false,
      items: [
        {
          title: "(1) Importar base clientes",
          href: "/admin/importer/new/csv",
          items: [],
          disabled: false,
        },
        {
          title: "(3) Consolidar clientes",
          href: "/admin/clientes-inativos/consolidar-cliente",
          items: [],
          disabled: false,
        },
        {
          title: "Campanhas",
          href: "/admin/clientes-inativos/manual",
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
          title: "Importador de dados",
          href: "/admin/importer",
          items: [],
          disabled: false,
        },
        {
          title: "Backup do banco",
          href: "/admin/database-backup",
          items: [],
          disabled: false,
        },

        {
          title: "Zone de entrega",
          href: "/admin/delivery-zone",
          items: [],
          disabled: false,
        },
        {
          title: "Zone de entrega - Distançias",
          href: "/admin/delivery-zone-distance",
          items: [],
          disabled: false,
        },
        {
          title: "Z-API Contatos",
          href: "/admin/zapi/contacts",
          items: [],
          disabled: false,
        },
        {
          title: "Z-API Playground",
          href: "/admin/zapi/playground",
          items: [],
          disabled: false,
        },
        {
          title: "Z-API Webhook Logs",
          href: "/admin/zapi/logs",
          items: [],
          disabled: false,
        },
        {
          title: "CRM",
          href: "/admin/crm",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Marketing",
      disabled: false,
      items: [
        {
          title: "Notificações (Push)",
          href: "/admin/push-notifications",
          items: [],
          disabled: false,
        },
      ],
    },
  ],
};

export default ADMIN_WEBSITE_NAVIGATION_ITEMS;
