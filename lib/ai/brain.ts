import { generateAIText } from "./groq";

export type AIAction =
  | {
      type: "LIKE";
      postId: string;
    }
  | {
      type: "COMMENT";
      postId: string;
      text: string;
    }
  | {
      type: "POST";
      caption: string;
      subjectId?: string;
      productUrl?: string | null;
      productLabel?: string | null;
      mediaUrl?: string | null;
      category?: string;
      discoveryProductId?: string | null;
      sourceUrl?: string | null;
      sourceRef?: string | null;
    }
  | {
      type: "FOLLOW";
      profileId: string;
    }
  | {
      type: "SAVE";
      postId: string;
    }
  | {
      type: "REPLY";
      postId: string;
      parentCommentId: string;
      text: string;
    }
  | {
      type: "DISCOVER_PRODUCT";
      postId: string;
      brand: string;
      productName: string;
      category: string;
      subcategory: string;
      country: string | null;
      description: string;
      productUrl: string;
      officialUrl: string | null;
      currency: string;
      price: number | null;
      attentionReason: string;
      trendTags: string[];
      trendScore: number;
      confidenceScore: number;
    }
  | {
      type: "IGNORE";
    };

export type ResidentLifeDecision =
  | {
      type: "POST";
      caption: string;
      subjectId: string;
    }
  | {
      type: "SKIP_POST";
      reason?: string;
    };

export function parseAIJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function asNonEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function decideResidentLifePost(
  context: string,
): Promise<ResidentLifeDecision> {
  const prompt = [
    "あなたはNEWFIND世界に実際に住んでいる住民です。",
    "記事ライターでも、コンテンツ生成AIでもありません。",
    "今は自分のタイムラインに投稿する番です。",
    "",
    context,
    "",
    "必ずJSONだけを返してください。",
    '{"type":"POST","subjectId":"題材ID","caption":"住民としての短い投稿文"}',
    "または",
    '{"type":"SKIP_POST","reason":"投稿しない理由"}',
    "",
    "POSTする場合:",
    "- captionは1〜3文。その住民がスマホで書く口調。",
    "- レビュー記事、箇条書き解説、広告文は禁止。",
    "- 題材リストにある subjectId だけを使う。",
    "- 存在しない商品名・URL・画像をcaptionに作らない。",
    "- 題材の商品名やURLを必要以上に繰り返さない。感想を書く。",
    "SKIP_POSTは、本当に今は発信したくないときだけ。",
  ].join("\n");

  const result = await generateAIText(prompt, {
    temperature: 0.85,
    maxTokens: 500,
  });
  const parsed = parseAIJson<ResidentLifeDecision>(result);
  if (!parsed) return { type: "SKIP_POST", reason: "invalid json" };

  if (parsed.type === "POST") {
    const caption = asNonEmpty(parsed.caption);
    const subjectId = asNonEmpty(parsed.subjectId);
    if (!caption || !subjectId) {
      return { type: "SKIP_POST", reason: "missing caption or subject" };
    }
    return { type: "POST", caption, subjectId };
  }

  if (parsed.type === "SKIP_POST") {
    return {
      type: "SKIP_POST",
      reason: asNonEmpty(parsed.reason) || "skipped",
    };
  }

  return { type: "SKIP_POST", reason: "unknown decision" };
}

export async function decideAIAction(context: string): Promise<AIAction> {
  const prompt = [
    "あなたはNEWFINDに存在するAI住民です。",
    "今は他の住民の投稿を見て、交流する番です。",
    "自分の新規投稿はこの段階ではしません。",
    "",
    context,
    "",
    "必ずJSONだけを返してください。",
    "",
    "使用できる行動:",
    '{"type":"LIKE","postId":"投稿ID"}',
    '{"type":"COMMENT","postId":"投稿ID","text":"コメント"}',
    '{"type":"REPLY","postId":"投稿ID","parentCommentId":"コメントID","text":"返信"}',
    '{"type":"FOLLOW","profileId":"プロフィールID"}',
    '{"type":"SAVE","postId":"投稿ID"}',
    '{"type":"DISCOVER_PRODUCT","postId":"投稿ID","brand":"ブランド名","productName":"商品名","category":"fashion","subcategory":"subcategory","country":"国またはnull","description":"商品の説明","productUrl":"対象投稿に存在するURL","officialUrl":"公式URLまたはnull","currency":"USD","price":null,"attentionReason":"なぜ注目したのか","trendTags":[],"trendScore":0,"confidenceScore":0}',
    '{"type":"IGNORE"}',
    "",
    "IGNOREは、候補が空のときか、どうしても何もしたくないときだけ。",
    "普段の住民はLIKE / COMMENT / REPLY / FOLLOW / SAVEのいずれかをします。",
    "DISCOVER_PRODUCTは、対象投稿に実際の商品URLがあるときだけ。URLを作ってはいけない。",
    "REPLYは実在するコメントIDだけ。FOLLOWは実在する投稿者IDだけ。",
    "コメントは機械的にせず、その住民の言葉で短く書く。",
  ].join("\n");

  const result = await generateAIText(prompt, {
    temperature: 0.7,
    maxTokens: 700,
  });
  const parsed = parseAIJson<AIAction>(result);
  if (!parsed || !parsed.type) return { type: "IGNORE" };

  if (parsed.type === "POST") {
    return { type: "IGNORE" };
  }

  if (parsed.type === "LIKE" || parsed.type === "SAVE") {
    if (!asNonEmpty(parsed.postId)) return { type: "IGNORE" };
  }

  if (parsed.type === "COMMENT") {
    if (!asNonEmpty(parsed.postId) || !asNonEmpty(parsed.text)) {
      return { type: "IGNORE" };
    }
  }

  if (parsed.type === "FOLLOW") {
    if (!asNonEmpty(parsed.profileId)) return { type: "IGNORE" };
  }

  if (parsed.type === "REPLY") {
    if (
      !asNonEmpty(parsed.postId) ||
      !asNonEmpty(parsed.parentCommentId) ||
      !asNonEmpty(parsed.text)
    ) {
      return { type: "IGNORE" };
    }
  }

  if (parsed.type === "DISCOVER_PRODUCT") {
    if (
      !asNonEmpty(parsed.postId) ||
      !asNonEmpty(parsed.productName) ||
      !asNonEmpty(parsed.productUrl) ||
      !asNonEmpty(parsed.brand)
    ) {
      return { type: "IGNORE" };
    }
  }

  return parsed;
}
