# Tracking do cardápio

Este documento descreve a infraestrutura nativa de tracking do cardápio e a
fronteira entre interesse por item e interação com a interface.

## Visão geral

O projeto já possui uma ferramenta própria de tracking, sem dependência de
eventos customizados pagos da Vercel:

- coleta de interesse por item;
- identificação anônima do navegador por `clientId`;
- persistência no PostgreSQL;
- dashboard administrativo em
  `/admin/gerenciamento/cardapio/dashboard/navegacao`.

Essa infraestrutura deve ser reutilizada como base para métricas de filtros,
mas os eventos de interface não devem ser gravados nas tabelas de interesse por
item.

## Referência de eventos

A estrutura segue o modelo conceitual dos custom events da Vercel:

- um nome estável para o evento;
- propriedades dimensionais curtas;
- identificação anônima do visitante;
- envio assíncrono sem bloquear a interação;
- agregação por período e propriedade.

O SDK e o armazenamento da Vercel não são utilizados. Os eventos ficam no
PostgreSQL do projeto e somente propriedades previamente permitidas são aceitas.

## Interesse por item

Arquivos principais:

- `app/domain/cardapio/menu-item-interest/menu-item-interest.client.ts`
- `app/domain/cardapio/menu-item-interest/menu-item-interest.server.ts`
- `app/routes/api.menu-item-interest.tsx`
- `app/routes/admin.gerenciamento.cardapio.dashboard.navegacao.tsx`

Tabelas:

- `item_interest_events`
- `menu_item_interest_events`

Eventos aceitos:

- `view_list`
- `open_detail`
- `like`
- `share`

Esses eventos exigem `itemId` ou `menuItemId` porque alimentam indicadores por
sabor:

- exposição;
- taxa de abertura;
- engajamento;
- ranking ponderado.

## Interações da interface

Cliques em filtros não pertencem ao modelo de interesse por item. Exemplos:

- selecionar o grupo `Pizza salgada`;
- selecionar o grupo `Pizza doce`;
- abrir ou fechar o painel `Filtrar`;
- selecionar uma tag;
- voltar para `Todos`.

Gravar esses eventos em `item_interest_events` exigiria um item artificial e
contaminaria os relatórios existentes.

## Implementação de navegação

O mesmo dashboard administrativo e os mesmos padrões de identificação são
reutilizados, com uma fonte separada para interações da interface.

Modelo:

```text
CardapioInteractionEvent
  id
  eventName
  control
  value
  placement
  clientId
  path
  createdAt
```

Tabela:

```text
cardapio_interaction_events
```

Evento:

```text
cardapio_navigation_click
```

Propriedades:

- `control`: `group`, `filter_toggle` ou `tag`;
- `value`: grupo, ação ou nome da tag;
- `placement`: `mobile_header`, `mobile_panel`, `desktop_nav` ou `stories`;
- `clientId`: o mesmo identificador anônimo usado no interesse por item;
- `path`: rota em que a interação ocorreu.

## Coleta sem bloquear a navegação

O cliente deve enviar o evento em segundo plano:

1. tentar `navigator.sendBeacon`;
2. usar `fetch` com `keepalive: true` como fallback;
3. não usar `await` no handler do botão;
4. ignorar falhas de telemetria na experiência do usuário.

O endpoint deve aceitar somente nomes e propriedades previamente permitidos,
limitar o tamanho dos valores e não persistir payload JSON arbitrário.

## Dashboard

O dashboard possui uma subpágina independente chamada `Navegação e filtros`,
sem misturar os dados com o ranking de sabores.

Indicadores:

- total de cliques por controle;
- tags mais selecionadas;
- uso por posição mobile/desktop;
- visitantes únicos por `clientId`;
- adoção: visitantes que usaram navegação divididos pelos visitantes do
  cardápio;
- interações médias por usuário;
- comparação entre mês atual e mês anterior.

## Decisão arquitetural

Reutilizar:

- o `clientId` anônimo;
- o padrão de endpoint Remix;
- PostgreSQL e Prisma;
- os filtros de período;
- a página administrativa de tracking.

Separar:

- tabela de eventos de interface;
- validação dos eventos;
- consultas e componentes de relatório.

Essa separação mantém os indicadores atuais corretos e permite ampliar o
tracking do cardápio sem depender da Vercel Analytics.
