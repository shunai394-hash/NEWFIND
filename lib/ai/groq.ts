import { repairMojibake } from "./text-encoding";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateAIText(prompt: string): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      reasoning_effort: "low",
      max_tokens: 1200,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content;


    if (typeof content !== "string" || !content.trim()) {
      console.error(
        "GROQ EMPTY RESPONSE:",
        JSON.stringify(response, null, 2),
      );

      throw new Error(
        `Groq returned an empty response (finish_reason=${choice?.finish_reason ?? "unknown"})`,
      );
    }

    return repairMojibake(content.trim());
  } catch (error) {
    console.error("GROQ API ERROR:", error);
    throw error;
  }
}

const VISION_MODEL =
  process.env.GROQ_VISION_MODEL?.trim() || "qwen/qwen3.6-27b";

const MAX_VISION_IMAGES = 3;

export type GroqImageInput = {
  url: string;
  label?: string;
};

function isValidImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function generateAITextWithImages(
  prompt: string,
  images: GroqImageInput[] = [],
): Promise<string> {
  const validImages = images
    .filter((image) => isValidImageUrl(image.url))
    .slice(0, MAX_VISION_IMAGES);

  if (validImages.length === 0) {
    return generateAIText(prompt);
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  for (const image of validImages) {
    content.push({
      type: "image_url",
      image_url: { url: image.url },
    });
  }

  try {
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.2,
      reasoning_effort: "low",
      max_tokens: 1200,
    });

    const choice = response.choices?.[0];
    const messageContent = choice?.message?.content;


    if (typeof messageContent !== "string" || !messageContent.trim()) {
      console.warn("GROQ VISION EMPTY RESPONSE, falling back to text.");
      return generateAIText(prompt);
    }

    return repairMojibake(messageContent.trim());
  } catch (error) {
    console.error("GROQ VISION API ERROR, falling back to text:", error);
    return generateAIText(prompt);
  }
}

