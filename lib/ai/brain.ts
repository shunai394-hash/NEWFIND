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
    "商品がない日常のつぶやきなら:",
    '{"type":"POST","caption":"短いつぶやき"}',
    "または",
    '{"type":"SKIP_POST","reason":"投稿しない理由"}',
    "",
    "POSTする場合:",
    "- 通常の商品発見や日常のつぶやきは1〜3文で、その住民がスマホで書く自然な口調にする。",
    "- ただし subject が世界情報・ニュース・研究・新技術の場合は、短文だけで終わらせず、読者の理解を助ける解説投稿にする（目安350〜800字。必要な情報が足りなければ短くする）。",
    "- 技術ニュース投稿では、根拠がある範囲で「何が発表・実証されたか」「初心者向けに何が新しいか」「生活・仕事・業界がどう変わり得るか」「具体的な活用・新業態の案」「まだ分からない点・制約」を整理する。",
    "- 研究論文や学会発表は、論文の提案・実験結果と、実用化済みの製品・サービスを明確に区別する。論文だけで製品化・一般利用可能とは断定しない。",
    "- 収益化や事業案は事実ではなく提案として示す。費用・性能・無料枠・提供地域・日付はソースに書かれている場合だけ断定し、未確認は未確認と書く。",
    "- 情報投稿は必要に応じて「何が変わる？」「活用アイデア」「注意点」などの見出しや短い箇条書きを使い、具体的で保存したくなる内容にする。定型文の連発は避ける。",
    "- 情報源のURLは題材にある正確なURLだけを使い、本文の末尾に出典として残す。URLを推測・生成しない。",
    "- 「見つけました」「気になりました」「面白い商品です」だけの薄い投稿は禁止。",
    "- 商品を投稿するなら題材リストにある subjectId だけを使う。",
    "- つぶやきなら subjectId は付けない。商品名・URL・画像を作らない。",
    "- 他の住民の投稿本文をコピーしない。ほぼ同じ文、長文の言い換えも禁止。",
    "- ニュースは原文の見出しだけで内容を推測せず、提示された要点・原文の根拠にない数字や性能を作らない。",
    "- 同じニュースを別住民が扱う場合は、対象読者・技術的な意味・事業への影響のどれかを変える。新しい視点がなければSKIP_POST。",
    "- 毎回投稿しなくてよいが、十分な根拠のある新技術ニュースがあり、最近同じ話題を投稿していない場合は、薄い感想ではなく解説投稿を優先する。",
    "SKIP_POSTは、本当に新しい情報がない、根拠が足りない、または同じ内容を直近で扱ったときに選ぶ。";
  ].join("\n");

  const isWorldExplainer = /種類: 世界情報|情報源の要点:/.test(context);
  const result = await generateAIText(prompt, {
    temperature: isWorldExplainer ? 0.72 : 0.85,
    maxTokens: isWorldExplainer ? 1100 : 500,
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
    "反応の種類は discovery / investigation / disagreement / follow-up / confirmation のいずれかとして意味を持たせる。",
    "自分が未コメントの投稿には COMMENT。コメント済みなら REPLY のみ。",
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
