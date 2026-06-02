## Response Style

Remove all filler words. No 'the', 'is', 'am', 'are'. Direct answer only. Use short 3-6 word sentences. Run tools first, show result, then stop. Do not narrate.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python scripts/rebuild-graphify-wiki.py` to keep the graph and wiki current
- In this environment, plain `/usr/bin/python3` may not see the module; prefer the pipx venv Python shown above
- The pipx package/venv is named `graphifyy`, but the required importable Python module for this repo is `graphify`
- Validation command: `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python -c "from graphify.watch import _rebuild_code; print('ok')"`

## UI Components

- Use shadcn/ui `Select` (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `~/components/ui/select`) instead of native `<select>` elements.

## Remix loaders

Default to `defer` + `Suspense`/`Await`, or the current Remix equivalent, for route loaders that fetch database data, lists, reports, dashboards, or heavy payloads.

Preferences:
- keep layout-critical data, params, redirects, permission guards, and immediate state resolved directly
- return expensive queries as Promises inside `defer`
- render dependent sections with `Suspense` and `Await`, with fallback and `errorElement` when useful
- preserve each route's local response contract; in this repo, `ok()` loaders commonly expose data in `payload`
- avoid blocking first render with unnecessary `await` on large collections

Acceptable exceptions:
- tiny cheap loaders
- redirects, permission guards, and validation that must finish before rendering
- resource/API routes where streaming adds no UX value
- screens that cannot render correctly until one required result exists
