import { repairMojibake } from "./text-encoding";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export type GenerateAITextOptions = {
  temperature?: number;
  maxTokens?: number;
};

function groqStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    error?: { status?: unknown };
  };
  const value = record.status ?? record.statusCode ?? record.error?.status;
  return typeof value === "number" ? value : null;
}

export function isRetryableAIError(error: unknown) {
  const status = groqStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return (
    status === 429 ||
    status === 503 ||
    status === 408 ||
    /rate limit|too many requests|timeout|temporar|unavailable|overloaded|ECONNRESET/i.test(
      message,
    )
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGroqRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableAIError(error) || attempt === 2) throw error;
      const wait = 800 * 2 ** attempt;
      console.warn(
        `GROQ retry ${attempt + 1} after ${wait}ms`,
        error instanceof Error ? error.message : error,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

export async function generateAIText(
  prompt: string,
  options?: GenerateAITextOptions,
): Promise<string> {
  try {
    const response = await withGroqRetry(() =>
      groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: options?.temperature ?? 0.2,
        reasoning_effort: "low",
        max_tokens: options?.maxTokens ?? 1200,
      }),
    );

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

