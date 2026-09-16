import type { ErrorKind } from "./types";

export function classifyErrorKind(error: unknown): ErrorKind {
  const message = (
    error instanceof Error ? error.message : String(error ?? "")
  ).toLowerCase();

  if (!message.trim()) return "unknown";
  if (/timeout|timed out|aborted|deadline/i.test(message)) return "timeout";
  if (/duplicate|already exists|23505/.test(message)) return "duplicate";
  if (/invalid product|not a product|generic\/non-product|category page/.test(message)) {
    return "invalid_product";
  }
  if (/verif/.test(message)) return "verification_failure";
  if (/post fail|failed to post|ai_posts|caption/.test(message)) return "post_failure";
  if (/supabase|postgres|database|42703|permission denied|rls/.test(message)) {
    return "database";
  }
  if (/groq|openai|llm|generateaitext|ai api|429|rate limit/.test(message)) {
    return "ai_api";
  }
  if (/search|world search|brave|serper|fetch failed/.test(message)) return "search";
  return "unknown";
}

export function errorKindLabel(kind: ErrorKind | string | null | undefined) {
  switch (kind) {
    case "search":
      return "Search error";
    case "ai_api":
      return "AI API error";
    case "database":
      return "Database error";
    case "timeout":
      return "Timeout";
    case "invalid_product":
      return "Invalid product";
    case "duplicate":
      return "Duplicate";
    case "verification_failure":
      return "Verification failure";
    case "post_failure":
      return "Post failure";
    default:
      return "Unknown error";
  }
}
