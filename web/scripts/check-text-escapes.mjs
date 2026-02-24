import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

const targets = ["src/pages", "src/components"];
const exts = [".ts", ".tsx", ".js", ".jsx", ".css"];
const unicodeEscape = /\\u[0-9A-Fa-f]{4}/g;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

let failed = false;

for (const base of targets) {
  for await (const file of walk(base)) {
    if (!exts.some((ext) => file.endsWith(ext))) continue;
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(unicodeEscape)) {
      const line = content.slice(0, match.index ?? 0).split("\n").length;
      console.error(`[text-escape] ${file}:${line} -> ${match[0]}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("\nFound literal unicode escapes in UI text. Use real characters.");
  process.exit(1);
}

console.log("check-text-escapes: ok");
