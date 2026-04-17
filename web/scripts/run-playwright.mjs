import { spawn } from "node:child_process";
import fs from "node:fs";

const chromiumCandidates = [
  process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter(Boolean);

const resolvedChromium = chromiumCandidates.find((candidate) => fs.existsSync(candidate));

const env = {
  ...process.env,
};

if (resolvedChromium && !env.PLAYWRIGHT_EXECUTABLE_PATH) {
  env.PLAYWRIGHT_EXECUTABLE_PATH = resolvedChromium;
}

if (resolvedChromium && !env.PLAYWRIGHT_DISABLE_ARTIFACTS) {
  env.PLAYWRIGHT_DISABLE_ARTIFACTS = "1";
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
