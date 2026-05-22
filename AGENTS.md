## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python scripts/rebuild-graphify-wiki.py` to keep the graph and wiki current
- In this environment, plain `/usr/bin/python3` may not see the module; prefer the pipx venv Python shown above
- The pipx package/venv is named `graphifyy`, but the required importable Python module for this repo is `graphify`
- Validation command: `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python -c "from graphify.watch import _rebuild_code; print('ok')"`

## Desenvolvimento

Nao execute `npm run build` para alteracoes pequenas.

Durante desenvolvimento:

- aproveite o HMR do Vite
- execute apenas verificacoes localizadas
- evite validacoes globais desnecessarias

## TypeScript

Nao execute verificacao completa de TypeScript (`tsc`) a cada alteracao.

Evite:

- `npx tsc`
- `tsc --noEmit`

Execute TypeScript completo apenas quando:

- alterar tipos globais
- alterar contratos compartilhados
- alterar configuracoes TypeScript
- finalizar tarefas grandes
- antes de commit importante
- antes de deploy

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
