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
