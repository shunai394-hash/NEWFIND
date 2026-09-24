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

async function main() {
  loadEnvLocal();

  const token = process.env.MERCARI_ACCESS_TOKEN;
  const clientName = process.env.MERCARI_API_CLIENT_NAME;

  console.log("=== CONFIG ===");
  console.log("TOKEN:", token ? "<SET>" : "<NOT SET>");
  console.log("CLIENT_NAME:", clientName || "<NOT SET>");

  const response = await fetch(
    "https://api.mercari-shops.com/v1/graphql",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `${clientName}/0.0.0`,
      },
      body: JSON.stringify({
        query: `
          query shop {
            shop {
              id
              name
              businessKind
              createdAt
              shopStatus
            }
          }
        `,
      }),
    },
  );

  console.log("=== RESPONSE ===");
  console.log("STATUS:", response.status);
  console.log("STATUS_TEXT:", response.statusText);
  console.log("CONTENT_TYPE:", response.headers.get("content-type"));
  console.log("SERVER:", response.headers.get("server"));
  console.log("LOCATION:", response.headers.get("location"));

  const text = await response.text();

  console.log("=== BODY ===");
  console.log(text || "<EMPTY>");
}

main().catch((error) => {
  console.error("=== TEST ERROR ===");
  console.error(error);
  process.exitCode = 1;
});
