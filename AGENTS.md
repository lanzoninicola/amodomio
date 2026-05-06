## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
- In this environment, plain `/usr/bin/python3` may not see the module; prefer the pipx venv Python shown above
- The pipx package/venv is named `graphifyy`, but the required importable Python module for this repo is `graphify`
- Validation command: `/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python -c "from graphify.watch import _rebuild_code; print('ok')"`
