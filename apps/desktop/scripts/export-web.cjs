const { spawnSync } = require("node:child_process");
const path = require("node:path");
const mobile = path.resolve(__dirname, "../../mobile");
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
if (result.status === 0) {
  require("node:fs").cpSync(
    path.resolve(__dirname, "../oven-alert"),
    path.resolve(__dirname, "../web/oven-alert"),
    { recursive: true }
  );
  require("node:fs").cpSync(
    path.resolve(__dirname, "../settings"),
    path.resolve(__dirname, "../web/settings"),
    { recursive: true }
  );
  require("node:fs").copyFileSync(
    path.resolve(mobile, "assets/oven-alert.wav"),
    path.resolve(__dirname, "../web/settings/oven-alert.wav")
  );
}
process.exit(result.status ?? 1);
