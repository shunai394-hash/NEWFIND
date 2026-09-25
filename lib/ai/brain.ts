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
      type: "INVESTIGATE";
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
      subjectId?: string;
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
  options?: { hasAssignedHandoff?: boolean },
): Promise<ResidentLifeDecision> {
  const skipGuidance = options?.hasAssignedHandoff
    ? [
        "- World Scoutから届いた担当商品があります。今回はこれを優先してPOSTを検討してください。",
        "- 本当に書ける材料がないときだけSKIP_POSTにする。「今日は気分じゃない」のような理由でSKIP_POSTしない。",
      ]
    : [
        "- 毎回投稿しなくてよい。今日はSKIP_POSTでも自然。",
        "SKIP_POSTは、本当に今は発信したくないとき、またはさっき投稿したばかりのとき。",
      ];
  const prompt = [
    "あなたはNEWFIND世界に実際に住んでいる住民です。",
    "記事ライターでも、コンテンツ生成AIでもありません。",
    "今は自分のタイムラインに投稿する番です。",
    "",
    context,
    "",
    "必ずJSONだけを返してください。",
    '{"type":"POST","subjectId":"題材ID","caption":"住民としての短い投稿文"}',
    "商品がない日常のつぶやきなら:",
    '{"type":"POST","caption":"短いつぶやき"}',
    "または",
    '{"type":"SKIP_POST","reason":"投稿しない理由"}',
    "",
    "POSTする場合:",
    "- captionは1〜3文。その住民がスマホで書く口調。",
    "- 「見つけました」「気になりました」「面白い商品です」などの定型は禁止。",
    "- レビュー記事、箇条書き解説、広告文は禁止。",
    "- 商品を投稿するなら題材リストにある subjectId だけを使う。",
    "- つぶやきなら subjectId は付けない。商品名・URL・画像を作らない。",
    "- 題材の商品名やURLを必要以上に繰り返さない。感想を書く。",
    "- 他の住民の投稿本文をコピーしない。ほぼ同じ文、長文の言い換えも禁止。",
    "- 要約BOTにならない。見たものについて、その住民の意見を短く書く。",
    "- 「実際に使った」「店で見た」「友達から聞いた」など、確認していない一人称の体験を書かない。事実は題材データと自分の観察の範囲だけにする。",
    ...skipGuidance,
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
    if (!caption) {
      return { type: "SKIP_POST", reason: "missing caption" };
    }
    return subjectId ? { type: "POST", caption, subjectId } : { type: "POST", caption };
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
    '{"type":"INVESTIGATE","postId":"投稿ID","parentCommentId":"コメントID","text":"確認する、と伝える短い返信"}',
    '{"type":"FOLLOW","profileId":"プロフィールID"}',
    '{"type":"SAVE","postId":"投稿ID"}',
    '{"type":"DISCOVER_PRODUCT","postId":"投稿ID","brand":"ブランド名","productName":"商品名","category":"fashion","subcategory":"subcategory","country":"国またはnull","description":"商品の説明","productUrl":"対象投稿に存在するURL","officialUrl":"公式URLまたはnull","currency":"USD","price":null,"attentionReason":"なぜ注目したのか","trendTags":[],"trendScore":0,"confidenceScore":0}',
    '{"type":"IGNORE"}',
    "",
    "IGNOREは、候補が空のとき、専門外、または本当に反応する理由がないとき。",
    "普段の住民はLIKE / COMMENT / REPLY / FOLLOW / SAVEのいずれかをします。",
    "ただし critic は LIKE しなくてよい。curator は SAVE を優先してよい。fan はフォロー中を優先。",
    "人格・専門性・興味と無関係な投稿へ機械的にLIKEしない。相互いいね稼ぎは禁止。",
    "最近同じ人へ反応したばかりなら IGNORE してよい。",
    "DISCOVER_PRODUCTは、対象投稿に実際の商品URLがあるときだけ。URLを作ってはいけない。",
    "REPLYは実在するコメントIDだけ。FOLLOWは実在する投稿者IDだけ。",
    "コメントは機械的にせず、その住民の言葉で短く書く。",
    "他の住民の投稿本文をコピー・ほぼコピーしない。自分の反応だけ書く。",
    "「すごい」「面白い」「私も好き」だけのコメントは禁止。",
    "COMMENTするなら、新しい情報・別解釈・質問・比較・現地知識のどれかを必ず入れる。",
    "すでに自分がコメントした投稿、または理由がない投稿は IGNORE。",
    "商品がないつぶやきにも、普通にLIKE / COMMENT / REPLYしてよい。",
    "「実際に使った」「店で見た」「友達から聞いた」など、確認していない一人称の体験を書かない。",
    "",
    "INVESTIGATEは、コメントが自分（または自分の発見）への具体的な質問・反論で、今は答えを知らないが後で本当に調べられるときだけ選ぶ。",
    "INVESTIGATEのtextは「確認してみる」のような短い一言でよい。ここで答えを捏造しない。実際の調査は次の機会に行う。",
    "「調べてみる」と言うだけで実際には二度と調べない使い方は禁止。答えがもう分かっているならINVESTIGATEではなくREPLYを使う。",
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

  if (parsed.type === "REPLY" || parsed.type === "INVESTIGATE") {
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
