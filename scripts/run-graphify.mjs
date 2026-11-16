import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const target = process.argv[2] ?? "all";
const supportedTargets = new Set(["all", "graph", "wiki"]);

if (!supportedTargets.has(target)) {
  console.error(`Unknown graphify target: ${target}`);
  process.exit(2);
}

const configuredPython = process.env.GRAPHIFY_PYTHON;
const candidates = configuredPython
  ? [configuredPython]
  : process.platform === "win32"
    ? [resolve(".venv-graphify", "Scripts", "python.exe")]
    : [
        "/home/lanzo/.local/share/pipx/venvs/graphifyy/bin/python",
        resolve(".venv-graphify", "bin", "python"),
      ];

const python = candidates.find(existsSync);

if (!python) {
  console.error(
    "Graphify Python was not found. Create .venv-graphify or set GRAPHIFY_PYTHON.",
  );
  process.exit(1);
}

const result = spawnSync(
  python,
  [resolve("scripts", "rebuild-graphify-wiki.py"), target],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
