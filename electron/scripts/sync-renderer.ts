import path from "node:path";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";

const electronRoot = path.resolve(__dirname, "..");
const webDistPath = path.resolve(electronRoot, "..", "web", "dist");
const rendererDistPath = path.resolve(electronRoot, "renderer-dist");

async function main() {
  if (!existsSync(webDistPath)) {
    throw new Error("web/dist nao encontrado. Rode o build da pasta web antes de sincronizar.");
  }

  await rm(rendererDistPath, { recursive: true, force: true });
  await cp(webDistPath, rendererDistPath, { recursive: true });

  console.log(`renderer-dist sincronizado a partir de ${webDistPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
