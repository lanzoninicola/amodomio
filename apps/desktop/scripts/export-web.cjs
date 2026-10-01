const { spawnSync } = require("node:child_process");
const path = require("node:path");
const mobile = path.resolve(__dirname, "../../kds-mobile");
const cli = require.resolve("expo/bin/cli", { paths: [mobile] });
const result = spawnSync(
  process.execPath,
  [
    cli,
    "export",
    "--platform",
    "web",
    "--output-dir",
    path.resolve(__dirname, "../web"),
  ],
  {
    cwd: mobile,
    stdio: "inherit",
    // The operator supplies the server URL; never embed a developer's .env in an installer.
    env: { ...process.env, EXPO_NO_DOTENV: "1", EXPO_PUBLIC_API_URL: "" },
  }
);
process.exit(result.status ?? 1);
