import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const apiRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(apiRoot, "..");
const envFiles = [
  path.join(workspaceRoot, ".env"),
  path.join(apiRoot, ".env"),
];

for (const envFile of envFiles) {
  if (!existsSync(envFile)) {
    continue;
  }

  dotenv.config({ path: envFile });
}
