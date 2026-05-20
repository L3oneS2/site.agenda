#!/usr/bin/env node
/**
 * Build de produção sem embutir server secrets do `.env.local`.
 * Next.js carrega `.env.local` em `next build`; movemos o ficheiro temporariamente se tiver secrets.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_SECRET_ENV_KEYS } from "./server-secret-env-keys.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");
const envLocalBak = path.join(root, ".env.local.__build_bak__");

function fileHasServerSecrets(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf8");
  return SERVER_SECRET_ENV_KEYS.some((key) => {
    const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m && String(m[1]).trim().length > 0;
  });
}

function scrubProcessEnv(env) {
  const out = { ...env };
  for (const key of SERVER_SECRET_ENV_KEYS) {
    delete out[key];
  }
  return out;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: scrubProcessEnv({ ...process.env, NODE_ENV: "production" }),
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

let movedEnvLocal = false;

try {
  if (fileHasServerSecrets(envLocal)) {
    if (fs.existsSync(envLocalBak)) {
      console.error(
        "[build-production] Já existe .env.local.__build_bak__ — remova ou renomeie antes de continuar."
      );
      process.exit(1);
    }
    fs.renameSync(envLocal, envLocalBak);
    movedEnvLocal = true;
    console.warn(
      "[build-production] .env.local afastado durante o build (continha server secrets). Será restaurado no fim."
    );
  }

  const prodLocal = path.join(root, ".env.production.local");
  if (fs.existsSync(prodLocal)) {
    console.log("[build-production] Usando .env.production.local para NEXT_PUBLIC_* no build.");
  } else {
    console.warn(
      "[build-production] Dica: crie .env.production.local só com NEXT_PUBLIC_* e STRIPE_PRICE_ID para o build local."
    );
  }

  run("npx", ["next", "build"]);
  run("npx", ["@opennextjs/cloudflare", "build", "--skipNextBuild"]);
  run("node", ["scripts/scan-open-next-for-secrets.mjs"]);
} finally {
  if (movedEnvLocal && fs.existsSync(envLocalBak)) {
    fs.renameSync(envLocalBak, envLocal);
    console.log("[build-production] .env.local restaurado.");
  }
}
