# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

Start the Remix development asset server and the Express server by running:

```sh
npm run dev
```

This starts your app in development mode, which will purge the server require cache when Remix rebuilds assets so you don't need a process manager restarting the express server.

## Prisma

Prisma configuration, env vars, and migration notes are documented in:

- `prisma/README.md`

## KDS REST API

Documentação da API REST do KDS (criação de pedidos e delivery zones):

- `app/domain/kds/README.md`

## Domínio Cardápio (RecipeSheet)

Regras de modelagem para evitar duplicação entre `Recipe` (base técnica) e `RecipeSheet` (aplicação comercial por item+tamanho):

- `app/domain/cardapio/recipe-sheet/README.md`

## Painel WhatsApp Sem Resposta (Admin)

O painel flutuante de alertas no admin lista conversas que precisam de ação do atendente.

### Regra de exibição

- A lista considera eventos do dia (timezone `America/Sao_Paulo`).
- Para cada cliente, avalia o último evento registrado.
- O cliente aparece no painel quando o último evento é `WHATSAPP_SENT` e já passou o tempo mínimo (`DEFAULT_REPLY_WAIT_SECONDS`, hoje `90s`).
- Se o último evento for `WHATSAPP_RECEIVED`, o cliente não aparece no painel.

### Resposta rápida via Settings

O botão de resposta rápida usa mensagem configurável em `setting`:

- `context=whatsapp-no-response`
- `name=quick-reply-message`

Compatibilidade legada:

- `context=admin-wpp-alert-panel` (fallback de leitura)

Implementação:

- `app/routes/admin.tsx` (loader/query do painel)
- `app/routes/api.admin-wpp-alerts.tsx` (ações e leitura da mensagem)

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying express applications you should be right at home just make sure to deploy the output of `remix build`

- `build/`
- `public/build/`

### Using a Template

When you ran `npx create-remix@latest` there were a few choices for hosting. You can run that again to create a new project, then copy over your `app/` folder to the new project that's pre-configured for your target server.

```sh
cd ..
# create a new project, and pick a pre-configured host
npx create-remix@latest
cd my-new-remix-app
# remove the new project's app (not the old one!)
rm -rf app
# copy your app over
cp -R ../my-old-remix-app/app app
```

## Proteção de Merge no `vercel-prod`

Para reduzir risco de deploy com falha no cardápio público, o projeto usa dois checks:

1. `Vercel Prod Loader Guard` (`.github/workflows/vercel-prod-loader-guard.yml`)
2. `Cardapio Loader Smoke` (`.github/workflows/cardapio-loader-smoke.yml`)

### O que cada check valida

- `Vercel Prod Loader Guard`:
  - roda em `pull_request` para `vercel-prod`
  - executa `app/routes/cardapio._index.loader.test.ts`
  - garante comportamento esperado do loader blocante do cardápio

- `Cardapio Loader Smoke`:
  - roda em `deployment_status` (após deploy bem-sucedido da Vercel)
  - valida a rota `/cardapio` no preview
  - falha se detectar contingência ativa (`Redirecionamento automático`)

### Configuração recomendada no GitHub

Em `Settings > Branches > Branch protection rules` para `vercel-prod`:

1. Ativar `Require status checks to pass before merging`
2. Marcar como obrigatórios:
   - `Vercel Prod Loader Guard / cardapio-loader-blocker-test`
   - `Cardapio Loader Smoke / smoke-cardapio-loader`

### Observação sobre simulação de erro

O setting `context=cardapio`, `name=contingencia.simula.erro`, `value=true` força a contingência.
Se estiver ativo em preview/deploy, os checks podem falhar por design.
