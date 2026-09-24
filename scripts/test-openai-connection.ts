import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const key = process.env.OPENAI_API_KEY;

  console.log("OPENAI_API_KEY:", key ? "SET" : "MISSING");

  if (!key) process.exit(1);

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  console.log("OpenAI API status:", response.status);

  if (!response.ok) {
    console.log(await response.text());
    process.exit(1);
  }

  console.log("OpenAI API connection: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
