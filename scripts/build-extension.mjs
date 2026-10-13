import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extension = join(root, "apps/suitable-extension");
const packageOnly = process.argv.includes("--no-upload");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--no-upload");
const folderId = process.env.EXTENSION_DRIVE_FOLDER_ID || "1Nj1uctv-kyEHECYeTqIKqTabKgXSEubR";
const remote = process.env.EXTENSION_DRIVE_REMOTE || "amodomio-drive";

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: "inherit", ...options });
}

try {
  if (unknown.length) throw new Error(`Argumentos desconhecidos: ${unknown.join(", ")}`);
  if (!/^[\w-]+$/.test(folderId)) throw new Error("EXTENSION_DRIVE_FOLDER_ID deve conter apenas o ID da pasta.");
  if (!/^[\w-]+$/.test(remote)) throw new Error("EXTENSION_DRIVE_REMOTE deve conter apenas o nome do remote.");
  try {
    run("zip", ["-v"], { stdio: "ignore" });
  } catch {
    throw new Error("Instale o comando zip para empacotar a extensão.");
  }
  if (!packageOnly) {
    let remotes;
    try {
      remotes = run("rclone", ["listremotes"], { stdio: "pipe", encoding: "utf8" });
    } catch {
      throw new Error("Instale o rclone e execute rclone config para configurar o Google Drive. Para gerar somente o ZIP: npm run build:extension -- --no-upload");
    }
    if (!remotes.split(/\r?\n/).includes(`${remote}:`)) {
      throw new Error(`Configure um remote Google Drive chamado ${remote} com rclone config (veja apps/suitable-extension/README.md).`);
    }
  }

  run(process.execPath, [join(extension, "build.mjs")]);
  const { version } = JSON.parse(readFileSync(join(extension, "manifest.json"), "utf8"));
  if (!/^[\d.]+$/.test(version)) throw new Error("Versão inválida no manifest da extensão.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `suitable-amodomio-${version}-${stamp}.zip`;
  const output = join(root, "build/extensions", name);
  mkdirSync(dirname(output), { recursive: true });
  const temporary = mkdtempSync(join(tmpdir(), "suitable-package-"));
  try {
    const staging = join(temporary, "suitable-extension");
    mkdirSync(staging);
    // Allowlist: never include sources, tests, fixtures or local credentials.
    for (const file of ["manifest.json", "background.js", "activation.js", "parser.js", "content.js", "popup.html", "popup.css", "popup.js", "fonts"]) {
      cpSync(join(extension, file), join(staging, file), { recursive: true });
    }
    run("zip", ["-q", "-r", output, "suitable-extension"], { cwd: temporary });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log(`ZIP gerado: ${output}`);
  if (!packageOnly) {
    run("rclone", ["copyto", output, `${remote}:${name}`, "--drive-root-folder-id", folderId, "--immutable", "--progress"]);
    console.log(`Enviado para https://drive.google.com/drive/folders/${folderId}`);
  }
} catch (error) {
  console.error(`Falha no build da extensão: ${error.message}`);
  process.exitCode = 1;
}
