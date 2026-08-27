/**
 * Apply additive migration 054 via the Supabase SQL endpoint if linked,
 * otherwise print the file path. Never touches migrations 009-053.
 *
 *   npx tsx scripts/apply-migration-054.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function parseEnvLocal(): Map<string, string> {
  const map = new Map<string, string>();
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

const FILE = resolve(process.cwd(), "supabase/migrations/054_product_saves_alerts.sql");

function main() {
  if (!existsSync(FILE)) {
    console.error("missing", FILE);
    process.exit(1);
  }
  const env = parseEnvLocal();
  const dbUrl =
    env.get("DATABASE_URL") ||
    env.get("SUPABASE_DB_URL") ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    "";

  const attempts: Array<{ cmd: string; args: string[] }> = [];
  if (dbUrl) {
    attempts.push({ cmd: "psql", args: [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", FILE] });
  }
  attempts.push({
    cmd: "npx",
    args: ["supabase", "db", "query", `-f`, FILE],
  });
  attempts.push({
    cmd: "npx",
    args: ["supabase", "sql", "--file", FILE],
  });

  for (const attempt of attempts) {
    console.log("try", attempt.cmd, attempt.args.join(" "));
    const result = spawnSync(attempt.cmd, attempt.args, {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, DATABASE_URL: dbUrl || process.env.DATABASE_URL },
    });
    if (result.status === 0) {
      console.log("migration 054 applied");
      return;
    }
  }

  console.log("CLI apply did not succeed; will try Management API / postgres-meta next in seed script.");
}

main();
