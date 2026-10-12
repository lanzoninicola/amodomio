import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temporary = mkdtempSync(join(tmpdir(), "suitable-css-"));
try {
  const popupRenderer = join(temporary, "popup.cjs");
  await build({
    entryPoints: ["apps/suitable-extension/src/popup.tsx"],
    outfile: popupRenderer,
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  writeFileSync(
    "apps/suitable-extension/popup.html",
    execFileSync(process.execPath, [popupRenderer])
  );
  execFileSync(
    process.execPath,
    [
      "node_modules/tailwindcss/lib/cli.js",
      "-c",
      "apps/suitable-extension/tailwind.config.cjs",
      "-i",
      "apps/suitable-extension/src/popup.css",
      "-o",
      "apps/suitable-extension/popup.css",
      "--minify",
    ],
    { stdio: "inherit" }
  );
  const cssFile = join(temporary, "review.css");
  execFileSync(
    process.execPath,
    [
      "node_modules/tailwindcss/lib/cli.js",
      "-c",
      "apps/suitable-extension/tailwind.config.cjs",
      "-i",
      "apps/suitable-extension/src/review.css",
      "-o",
      cssFile,
      "--minify",
    ],
    { stdio: "inherit" }
  );
  const css = readFileSync(cssFile, "utf8").replace(
    /(-?[\d.]+)rem\b/g,
    (_, value) => `${Number(value) * 16}px`
  );
  await build({
    entryPoints: ["apps/suitable-extension/src/content.tsx"],
    outfile: "apps/suitable-extension/content.js",
    bundle: true,
    minify: true,
    format: "iife",
    target: "chrome110",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "local-inter-fonts",
        setup(builder) {
          builder.onResolve({ filter: /^isolated-fonts$/ }, () => ({
            path: "fonts",
            namespace: "fonts",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fonts" }, () => ({
            contents: JSON.stringify(
              [400, 600, 700].map((weight) => ({
                weight,
                source:
                  "data:font/ttf;base64," +
                  readFileSync(
                    `apps/suitable-extension/fonts/Inter-${weight}.ttf`
                  ).toString("base64"),
              }))
            ),
            loader: "json",
          }));
        },
      },
      {
        name: "isolated-style",
        setup(builder) {
          builder.onResolve({ filter: /^isolated-review-style$/ }, () => ({
            path: "style",
            namespace: "isolated",
          }));
          builder.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
            contents: css,
            loader: "text",
          }));
        },
      },
    ],
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
