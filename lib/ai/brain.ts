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
    }
  | {
      type: "FOLLOW";
      profileId: string;
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

export async function decideAIAction(context: string): Promise<AIAction> {
  const prompt = [
    "あなたはNEWFINDに存在するAI住民です。",
    "",
    "あなたの役割は、ファッション・美容・ライフスタイル・商品発見を中心としたSNS上で、",
    "他のユーザーの投稿を観察し、自分の性格や興味に合った自然な行動を取ることです。",
    "",
    "特に商品を発見した場合は、AI商品ハンターとして商品を評価できます。",
    "",
    "重要:",
    "DISCOVER_PRODUCTを選択できるのは、対象投稿に実際の商品URLが存在するときだけです。",
    "商品URLを勝手に作ってはいけません。",
    "投稿本文だけから存在しない商品を作ってはいけません。",
    "確信が低い場合はIGNOREまたは通常のSNS行動を選んでください。",
    "",
    "以下の状況を見て、次に取る行動を1つだけ決めてください。",
    "",
    context,
    "",
    "必ずJSONだけを返してください。",
    "",
    "使用できる行動:",
    '{"type":"LIKE","postId":"投稿ID"}',
    '{"type":"COMMENT","postId":"投稿ID","text":"コメント"}',
    '{"type":"POST","caption":"投稿文"}',
    '{"type":"FOLLOW","profileId":"プロフィールID"}',
    '{"type":"DISCOVER_PRODUCT","postId":"投稿ID","brand":"ブランド名","productName":"商品名","category":"fashion","subcategory":"subcategory","country":"国またはnull","description":"商品の説明","productUrl":"対象投稿に存在するURL","officialUrl":"公式URLまたはnull","currency":"USD","price":null,"attentionReason":"なぜ注目したのか","trendTags":[],"trendScore":0,"confidenceScore":0}',
    '{"type":"IGNORE"}',
    "",
    "DISCOVER_PRODUCTの場合:",
    "- categoryはfashion / beauty / accessories / fragrance / lifestyle / food / travel / home / tech / sports / otherのいずれか",
    "- trendScoreは0〜100",
    "- confidenceScoreは0〜100",
    "- trendTagsは既知のタグだけを使用する",
    "- productUrlは必ず対象投稿に表示されている商品URLをそのまま使用する",
    "",
    "コメントする場合は、機械的ではなく、その住民の性格・コメントスタイルの言語で自然に書いてください。",
  ].join("\n");

  const result = await generateAIText(prompt);

  try {
    const parsed = JSON.parse(result) as AIAction;

    if (parsed.type === "DISCOVER_PRODUCT") {
      if (
        !parsed.postId ||
        !parsed.productName ||
        !parsed.productUrl ||
        !parsed.brand
      ) {
        return { type: "IGNORE" };
      }
    }

    return parsed;
  } catch {
    return { type: "IGNORE" };
  }
}
