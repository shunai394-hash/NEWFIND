import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateAIText(prompt: string): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content;

    console.log("=== GROQ RESPONSE DEBUG ===");
    console.log("model:", response.model);
    console.log("choices:", response.choices?.length ?? 0);
    console.log("finish_reason:", choice?.finish_reason ?? null);
    console.log("message_role:", choice?.message?.role ?? null);
    console.log("content_type:", typeof content);
    console.log("content_length:", content?.length ?? 0);
    console.log("usage:", response.usage ?? null);
    console.log("=== END GROQ RESPONSE DEBUG ===");

    if (typeof content !== "string" || !content.trim()) {
      console.error(
        "GROQ EMPTY RESPONSE:",
        JSON.stringify(response, null, 2),
      );

      throw new Error(
        `Groq returned an empty response (finish_reason=${choice?.finish_reason ?? "unknown"})`,
      );
    }

    return content.trim();
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
      max_tokens: 3000,
    });

    const choice = response.choices?.[0];
    const messageContent = choice?.message?.content;

    console.log("=== GROQ VISION RESPONSE DEBUG ===");
    console.log("model:", response.model);
    console.log("images:", validImages.length);
    console.log("finish_reason:", choice?.finish_reason ?? null);
    console.log("content_length:", messageContent?.length ?? 0);
    console.log("=== END GROQ VISION RESPONSE DEBUG ===");

    if (typeof messageContent !== "string" || !messageContent.trim()) {
      console.warn("GROQ VISION EMPTY RESPONSE, falling back to text.");
      return generateAIText(prompt);
    }

    return messageContent.trim();
  } catch (error) {
    console.error("GROQ VISION API ERROR, falling back to text:", error);
    return generateAIText(prompt);
  }
}
