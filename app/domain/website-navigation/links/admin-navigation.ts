import WEBSITE_LINKS from "./website-links";
import { WebsiteNavigationConfig } from "../types/navigation-types";
import { Shield } from "lucide-react";
import { todayLocalYMD } from "~/domain/kds";

const ADMIN_NAVIGATION_LINKS: WebsiteNavigationConfig = {
  mainNav: [WEBSITE_LINKS.admin, WEBSITE_LINKS.website],
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
          title: "Horários de atendimento",
          href: "/admin/atendimento/horarios",
          items: [],
          disabled: false,
        },
        {
          title: "Lista de sabores",
          href: "/admin/atendimento/lista-sabores",
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
          title: "Cardápios",
          href: "",
          items: [
            {
              title: "Cardápio Delivery",
              href: "/admin/gerenciamento/cardapio/main/list",
              items: [],
              disabled: false,
            },
            {
              title: "Cardápio Pizza Al Taglio",
              href: "/admin/gerenciamento/cardapio-pizza-al-taglio",
              items: [],
              disabled: false,
            },
          ],
          disabled: false,
        },
        {
          title: "Estrutura",
          href: "",
          items: [
            {
              title: "Grupos",
              href: "/admin/gerenciamento/cardapio/groups",
              items: [],
              disabled: false,
            },
            {
              title: "Tamanhos",
              href: "/admin/gerenciamento/cardapio/sizes",
              items: [],
              disabled: false,
            },
            {
              title: "Produtos",
              href: "/admin/products",
              items: [],
              disabled: false,
            },
          ],
          disabled: false,
        },
        {
          title: "Relatorios",
          href: "",
          items: [
            {
              title: "Visitas",
              href: "/admin/gerenciamento/cardapio/dashboard/visitas",
              items: [],
              disabled: false,
            },
            {
              title: "Dashboard de Interesse",
              href: "/admin/gerenciamento/cardapio/dashboard/tracking",
              items: [],
              disabled: false,
            },
            {
              title: "Menu Engineering Matrix",
              href: "/admin/gerenciamento/cardapio/dashboard/menu-engineering",
              items: [],
              disabled: false,
            },
          ],
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
      title: "PRECIFICAÇÃO",
      items: [
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
          title: "DNA",
          href: "/admin/financeiro/dna",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Produção",
      items: [
        {
          title: "Estoque de massa",
          href: `/admin/kds/atendimento/${todayLocalYMD()}/estoque-massa`,
          items: [],
          disabled: false,
        },
        {
          title: "Programação Diaria",
          href: "/admin/producao/progamacao-diaria",
          items: [],
          disabled: false,
        },
      ],
    },
    {
      title: "Financeiro",
      items: [
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
          title: "Fichas técnicas",
          href: "/admin/recipe-sheets",
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
          href: "/admin/bot/auto-responder",
          items: [],
          disabled: false,
        },
        {
          title: "Configurar Auto Responder",
          href: "/admin/bot/auto-responder/settings",
          items: [],
          disabled: false,
        },
        {
          title: "META Autoresponder",
          href: "/admin/bot/meta-auto-responder",
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
          title: "Configurações globais",
          href: "/admin/administracao/settings",
          items: [],
          disabled: false,
        },
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
      ],
    },
    {
      title: "CRM",
      disabled: false,
      items: [
        {
          title: "Clientes",
          href: "/admin/crm",
          items: [],
          disabled: false,
        },
        {
          title: "Relatório de inserções",
          href: "/admin/crm/jornada-de-inserimento",
          items: [],
          disabled: false,
        },
        {
          title: "Campanhas",
          href: "/admin/crm/campaigns",
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

export default ADMIN_NAVIGATION_LINKS;
