import fs from "node:fs";
import Groq from "groq-sdk";

const envPath = ".env.local";

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) continue;

    const key = match[1];
    let value = match[2];

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function main() {
  console.log("===== GROQ KEY =====");
  console.log(
    process.env.GROQ_API_KEY
      ? "GROQ_API_KEY: SET"
      : "GROQ_API_KEY: MISSING"
  );

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing in .env.local");
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  console.log("===== REQUEST =====");

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "user",
        content: [
          "次のJSONだけを返してください。",
          '{"type":"COMMENT","text":"これは日本語のテストコメントです。新しい商品を見つけました。"}',
        ].join("\n"),
      },
    ],
    temperature: 0.8,
    max_tokens: 500,
  });

  console.log("===== RESPONSE OBJECT =====");
  console.log(JSON.stringify(response, null, 2));

  const result =
    response.choices[0]?.message?.content?.trim() ?? "";

  console.log("===== RAW CONTENT =====");
  console.log(result);

  console.log("===== CONTENT LENGTH =====");
  console.log(result.length);

  console.log("===== UTF8 HEX =====");
  console.log(Buffer.from(result, "utf8").toString("hex"));

  console.log("===== CODE POINTS =====");
  console.log(
    [...result]
      .map((char) => `${char}=${char.codePointAt(0)?.toString(16)}`)
      .join(" ")
  );
}

main().catch((error) => {
  console.error("===== ERROR =====");
  console.error(error);
  process.exit(1);
});
