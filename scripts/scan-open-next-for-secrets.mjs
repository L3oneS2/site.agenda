#!/usr/bin/env node
/**
 * Falha o CI/build se `.open-next/` contiver padrões de secrets embutidos.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLE_SECRET_PATTERNS } from "./server-secret-env-keys.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openNextDir = path.join(root, ".open-next");

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, files);
    else if (/\.(js|mjs|cjs|json|wasm|txt)$/i.test(name.name)) files.push(p);
  }
  return files;
}

if (!fs.existsSync(openNextDir)) {
  console.error("[scan-secrets] Pasta .open-next/ não encontrada. Rode o build antes.");
  process.exit(1);
}

const hits = [];
for (const file of walk(openNextDir)) {
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) continue;
  const text = buf.toString("utf8");
  for (const { id, re } of BUNDLE_SECRET_PATTERNS) {
    if (re.test(text)) {
      hits.push({ file: path.relative(root, file), pattern: id });
    }
  }
}

if (hits.length > 0) {
  console.error("[scan-secrets] Possível vazamento de secret no bundle:");
  for (const h of hits.slice(0, 20)) {
    console.error(`  - ${h.pattern} em ${h.file}`);
  }
  if (hits.length > 20) {
    console.error(`  … e mais ${hits.length - 20} ocorrência(s).`);
  }
  console.error(
    "[scan-secrets] Refaça o build com `npm run build` (sem server secrets no .env.local durante o build)."
  );
  process.exit(1);
}

console.log("[scan-secrets] OK — nenhum padrão de secret encontrado em .open-next/");
