import fs from "node:fs";
import Groq from "groq-sdk";

const envText = fs.readFileSync(".env.local", "utf8");

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

async function main() {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "user",
        content: [
          "あなたはNEWFINDのAI住民Mikaです。",
          "次のJSONだけを返してください。",
          '{"type":"COMMENT","postId":"TEST-POST","text":"これはMikaからの日本語コメントです。新しい商品を見つけました。"}',
        ].join("\n"),
      },
    ],
    temperature: 0.8,
    max_tokens: 500,
  });

  const raw =
    response.choices[0]?.message?.content?.trim() ?? "";

  console.log("===== 1. GROQ RAW =====");
  console.log(raw);

  console.log("===== 2. GROQ RAW HEX =====");
  console.log(Buffer.from(raw, "utf8").toString("hex"));

  const action = JSON.parse(raw);

  console.log("===== 3. PARSED ACTION =====");
  console.log(action);

  console.log("===== 4. ACTION TEXT =====");
  console.log(action.text);

  console.log("===== 5. ACTION TEXT HEX =====");
  console.log(
    Buffer.from(action.text, "utf8").toString("hex")
  );

  console.log("===== 6. JSON STRINGIFY =====");
  const serialized = JSON.stringify(action);
  console.log(serialized);

  console.log("===== 7. JSON STRINGIFY HEX =====");
  console.log(
    Buffer.from(serialized, "utf8").toString("hex")
  );

  console.log("===== 8. ROUND TRIP =====");
  const reparsed = JSON.parse(serialized);
  console.log(reparsed.text);

  console.log("===== 9. ROUND TRIP HEX =====");
  console.log(
    Buffer.from(reparsed.text, "utf8").toString("hex")
  );
}

main().catch((error) => {
  console.error("===== ERROR =====");
  console.error(error);
  process.exit(1);
});
