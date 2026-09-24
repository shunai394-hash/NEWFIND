import { generateAIText } from "../lib/ai/groq";

async function main() {
  const result = await generateAIText(
    [
      "次のJSONだけを返してください。",
      '{"type":"COMMENT","text":"これは日本語のテストコメントです。新しい商品を見つけました。"}',
    ].join("\n"),
  );

  console.log("===== RAW RESULT =====");
  console.log(result);

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
  console.error(error);
  process.exit(1);
});

