/**
 * Apply living-world SQL (parent_comment_id + ai_investigations) via service role.
 * Uses PostgREST-incompatible DDL through the Supabase SQL HTTP API when available,
 * otherwise prints the migration path for manual apply.
 */
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const sqlPath = resolve(
    "supabase/migrations/20260921120000_living_world_investigations.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Prefer supabase db execute via Management API is not available with anon project URL.
  // Use the Postgres REST "rpc" is not an option for DDL.
  // Attempt the SQL endpoint used by supabase-js v2 database query tooling when configured.
  const candidates = [
    `${url.replace(/\/$/, "")}/postgres/v1/query`,
    `${url.replace(/\/$/, "")}/rest/v1/rpc/exec_sql`,
  ];

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ query: sql, q: sql }),
      });
      console.log(endpoint, response.status, await response.text());
      if (response.ok) {
        console.log("Migration applied via", endpoint);
        return;
      }
    } catch (error) {
      console.warn(endpoint, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    [
      "Could not apply DDL over HTTP.",
      `Open Supabase SQL editor and run: ${sqlPath}`,
      "Or: npx supabase db push",
      "",
      "Status machine + UI still work; persistence needs this migration.",
    ].join("\n"),
  );
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
