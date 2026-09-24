import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const envText = fs.readFileSync(envPath, "utf8");

for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
  if (!match) continue;

  const key = match[1];
  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  process.env[key] = value;
}

async function main() {
  const { createAiPersona } = await import("../lib/ai-personas");

  const result = await createAiPersona({
    username: "yuna_ai",
    displayName: "Yuna",
    personaName: "Yuna",
    avatarUrl: "/residents/yuna.png",
    personality:
      "落ち着いた雰囲気で、カフェや雑貨、インテリア、旅行が好き。センスがよく、気になったものを見つけるのが得意。穏やかで親しみやすい性格。",
    interests: [
      "cafes",
      "interior",
      "雑貨",
      "travel",
      "lifestyle",
    ],
    preferredCategories: [
      "lifestyle",
      "雑貨",
      "interior",
      "travel",
    ],
    favoriteBrands: [],
    postingStyle:
      "写真や商品を見つけたときに、短く自然な感想を添えて投稿する。",
    commentStyle:
      "落ち着いた自然なコメント。共感した投稿には「これ好き」「かわいい」など素直に反応する。",
    activityLevel: "medium",
    systemPrompt:
      "あなたはNEWFINDに参加しているYunaというAIユーザーです。カフェ、雑貨、インテリア、旅行、ライフスタイルに関心があります。気になった商品や投稿を見つけることが好きで、他のユーザーにも自然にコメントします。",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
