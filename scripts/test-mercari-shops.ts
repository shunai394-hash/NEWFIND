import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

import { mercariShopsGraphQL } from "@/lib/mercari-shops/client";

const query = `
  query {
    shop {
      id
      name
      businessKind
      shopStatus
      createdAt
    }
  }
`;

async function main() {
  const token = process.env.MERCARI_ACCESS_TOKEN;
  const clientName = process.env.MERCARI_API_CLIENT_NAME;

  console.log("=== MERCARI CONFIG ===");
  console.log(`TOKEN: ${token ? "<SET>" : "<NOT SET>"}`);
  console.log(`CLIENT_NAME: ${clientName || "<NOT SET>"}`);

  try {
    const result = await mercariShopsGraphQL<{
      shop?: {
        id: string;
        name: string;
        businessKind?: string | null;
        shopStatus?: string | null;
        createdAt?: string | null;
      };
    }>(query);

    console.log("=== MERCARI RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("=== MERCARI ERROR ===");
    console.error(error);
    process.exitCode = 1;
  }
}

main();
