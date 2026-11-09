## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python scripts/rebuild-graphify-wiki.py` to keep the graph and wiki current
- In this environment, plain `/usr/bin/python3` may not see the module; prefer the pipx venv Python shown above
- The pipx package/venv is named `graphifyy`, but the required importable Python module for this repo is `graphify`
- Validation command: `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python -c "from graphify.watch import _rebuild_code; print('ok')"`

## Node environment

Antes de executar qualquer comando Node/NPM/Prisma/Vite/Remix neste projeto,
carregue o nvm e ative a versao Node do projeto.

Use este prefixo para comandos que dependem de Node:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use >/dev/null 2>&1; <comando>
```

Se precisar fixar a versao esperada neste ambiente:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 20.19.0 >/dev/null 2>&1; <comando>
```

Nao execute `node`, `npm`, `npx`, `vite`, `prisma`, `remix` ou scripts do
`package.json` antes de ativar o Node correto com `nvm use`.

## Desenvolvimento

Nao execute `npm run build` para alteracoes pequenas.

Durante desenvolvimento:

- aproveite o HMR do Vite
- execute apenas verificacoes localizadas
- evite validacoes globais desnecessarias

## Componentes de UI

O componente `Select` deve sempre usar a implementacao do shadcn/ui.

## Remix loaders

Use `defer` + `Suspense`/`Await`, ou o padrao equivalente mais atual do Remix, como default para loaders de rotas que carregam dados de banco, listas, relatorios, dashboards ou payloads pesados.

Preferencias:

- mantenha dados essenciais de layout, parametros e estado imediato resolvidos diretamente no loader
- retorne consultas caras como Promises dentro de `defer`
- renderize as secoes dependentes com `Suspense` e `Await`, incluindo fallback e `errorElement` quando fizer sentido
- preserve o contrato local de resposta da rota; neste repo, loaders que usam `ok()` normalmente expõem dados em `payload`
- evite bloquear a primeira renderizacao com `await` desnecessario para colecoes grandes

Excecoes aceitaveis:

- loaders pequenos e baratos
- redirects, guards de permissao e validacoes que precisam acontecer antes da renderizacao
- rotas resource/API onde streaming nao melhora a experiencia
- fluxos em que a tela inteira depende de um unico resultado antes de poder renderizar corretamente

## TypeScript

Nunca execute verificacao de TypeScript (`tsc`). Sempre pule essa etapa,
mesmo em fluxos de verify/code-review/commit/deploy.

Evite sempre:

- `npx tsc`
- `tsc --noEmit`

Para pequenas alteracoes:

- confie nos erros do editor
- confie no Vite
- valide apenas os arquivos impactados

## Build

Antes de executar build completo, avalie:

- a mudanca afeta bundling?
- afeta SSR?
- afeta Prisma?
- afeta configuracoes?
- afeta dependencias?
- afeta entrypoints?

Se nao afetar, nao execute build.

So execute `npm run build` quando:

- houver alteracoes estruturais
- alteracoes em dependencias
- alteracoes SSR/server
- alteracoes Prisma schema
- alteracoes de configuracao
- antes de finalizar a tarefa

## Prisma

Nao execute `prisma generate` sem necessidade.

Execute apenas quando:

- houver alteracao no schema Prisma
- houver alteracao de models
- houver alteracao de enums
- houver alteracao de relacionamentos

## Performance de iteracao

Priorize velocidade de iteracao durante desenvolvimento.

Evite:

- rebuilds completos desnecessarios
- validacoes globais repetitivas
- verificacoes pesadas sem necessidade
- processos redundantes

## Settings

Novos registros da tabela `settings` devem ser exibidos e gerenciados junto aos
demais em `/admin/administracao/settings`.

Regras:

- use a lista e o editor generico existentes para settings adicionais
- nao crie cards, formularios ou secoes visuais isoladas para um setting novo
- controles especializados existentes podem permanecer quando oferecem uma
  experiencia de negocio propria, mas nao devem ser usados como precedente para
  settings adicionais
- garanta que o setting seja criado com contexto, nome, tipo e valor padrao para
  aparecer na lista geral
