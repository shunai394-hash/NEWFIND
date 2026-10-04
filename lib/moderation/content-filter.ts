const OBJECTIONABLE_TEXT_PATTERNS: RegExp[] = [
  /\b(?:porn(?:ography)?|xxx video|sex tape|nudes? leaked|adult video|sexual services|escort service)\b/i,
  /(?:ポルノ|アダルト動画|性的サービス|援交|売春|性器|裸動画|裸の写真)/i,
  /\b(?:i will kill you|kill you|rape you|murder you|death threat)\b/i,
  /(?:殺すぞ|殺してやる|ぶっ殺す|死ねよ?|レイプするぞ|殺害予告)/i,
  /\b(?:heil hitler|white power|kill all (?:jews|muslims|christians|immigrants))\b/i,
  /(?:民族浄化|皆殺しにしろ|特定民族を殺せ)/i,
];

export function isObjectionableUserText(...values: Array<string | null | undefined>): boolean {
  const text = values.filter(Boolean).join("\n").slice(0, 12000);
  return OBJECTIONABLE_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function assertPostContentAllowed(...values: Array<string | null | undefined>): void {
  if (isObjectionableUserText(...values)) {
    throw new Error("投稿内容がコミュニティガイドラインに反する可能性があります。内容を変更してください。");
  }
}
