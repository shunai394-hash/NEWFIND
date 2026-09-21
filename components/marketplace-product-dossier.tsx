import type { MarketplaceDossier } from "@/lib/marketplace/store";

function money(value: number | null | undefined, currency?: string | null) {
  if (value == null) return "取得できず";
  return `${value.toLocaleString()} ${currency ?? ""}`.trim();
}

function boolLabel(value: boolean | null | undefined) {
  if (value === true) return "はい";
  if (value === false) return "いいえ";
  return "取得できず";
}

export function MarketplaceProductDossier({
  dossier,
}: {
  dossier: MarketplaceDossier;
}) {
  const evaluation = dossier.evaluation;
  const latest = dossier.observations[0];
  const margin = dossier.margin;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-200 px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
          市場評価
        </p>
        {latest ? (
          <dl className="mt-3 space-y-1 text-sm text-neutral-700">
            <div>市場: {latest.marketplace}</div>
            <div>価格: {money(latest.price, latest.currency)}</div>
            <div>レビュー: {latest.reviewCount ?? "取得できず"}</div>
            <div>評価: {latest.rating ?? "取得できず"}</div>
            <div>取引シグナル: {latest.soldCount ?? "取得できず"}</div>
            <div>出品数: {latest.listingCount ?? "取得できず"}</div>
            <div>ランク: {latest.popularityRank ?? "取得できず"}</div>
            <div>観測: {latest.observedAt}</div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">市場観測はまだありません。</p>
        )}
        {dossier.observations.length > 1 ? (
          <div className="mt-3">
            <p className="text-[11px] text-neutral-400">価格推移（観測値のみ）</p>
            <ul className="mt-1 space-y-1 text-[12px] text-neutral-600">
              {dossier.observations.slice(0, 6).map((row) => (
                <li key={row.observedAt}>
                  {row.observedAt.slice(0, 16)} · {money(row.price, row.currency)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {evaluation ? (
          <p className="mt-3 text-sm">
            判定: {evaluation.decision} · 信頼度 {evaluation.confidence}
          </p>
        ) : null}
      </section>

      {evaluation ? (
        <section className="rounded-xl bg-neutral-50 px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            売れる理由 / WHY NOW
          </p>
          <p className="mt-2 text-sm text-neutral-700">{evaluation.demandReason}</p>
          <p className="mt-2 text-sm text-neutral-700">{evaluation.whyNow}</p>
          <p className="mt-2 text-[12px] text-neutral-500">
            AIは「絶対に売れる」とは判定しません。
          </p>
        </section>
      ) : null}

      {evaluation ? (
        <section className="rounded-xl border border-neutral-200 px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            FACT
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-neutral-700">
            {evaluation.facts.map((fact) => (
              <li key={fact.text}>{fact.text}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            HYPOTHESIS
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-neutral-700">
            {evaluation.hypotheses.length
              ? evaluation.hypotheses.map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))
              : <li>仮説はありません。</li>}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-neutral-200 px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
          仕入れ先
        </p>
        {dossier.suppliers.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            正規の仕入れ先はまだ確認できていません。マーケットプレイス出品者は仕入れ先に含めていません。
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {dossier.suppliers.map((row, index) => {
              const supplier = row as Record<string, unknown>;
              return (
                <li key={String(supplier.id ?? index)} className="rounded-xl bg-neutral-50 px-3 py-3">
                  <p className="text-sm font-semibold">
                    仕入れ先候補 {index + 1}: {String(supplier.supplier_name ?? "")}
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-600">
                    {String(supplier.supplier_type ?? "")}
                    {supplier.official_url ? ` · ${String(supplier.official_url)}` : ""}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-1 text-[12px] text-neutral-600">
                    <div>MOQ: {supplier.moq == null ? "取得できず" : String(supplier.moq)}</div>
                    <div>
                      卸価格: {money(supplier.unit_price as number | null, supplier.currency as string | null)}
                    </div>
                    <div>日本発送: {boolLabel(supplier.ships_to_japan as boolean | null)}</div>
                    <div>正規性: {String(supplier.authorized_status ?? "unknown")}</div>
                    <div>在庫: {String(supplier.stock_status ?? "取得できず")}</div>
                    <div>納期: {String(supplier.lead_time ?? "取得できず")}</div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
          収益性
        </p>
        {margin ? (
          <dl className="mt-2 space-y-1 text-sm text-neutral-700">
            <div>販売価格: {money(margin.salePrice as number | null, margin.saleCurrency as string | null)}</div>
            <div>仕入価格: {money(margin.unitCost as number | null, margin.unitCostCurrency as string | null)}</div>
            <div>送料: {money(margin.shippingCost as number | null)}</div>
            <div>
              推定粗利:{" "}
              {margin.estimatedGrossMargin == null
                ? "UNKNOWN"
                : `${margin.estimatedGrossMargin}%`}
            </div>
            <div>状態: {String(margin.marginStatus ?? "INCOMPLETE")}</div>
            <div>
              不明コスト:{" "}
              {Array.isArray(margin.unknownCosts)
                ? (margin.unknownCosts as string[]).join(", ")
                : "UNKNOWN"}
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            販売価格と仕入価格が揃っていないため粗利は計算しません。
          </p>
        )}
      </section>

      {evaluation ? (
        <section className="rounded-xl border border-neutral-900 px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            AI判断 / 人間確認
          </p>
          <p className="mt-2 text-sm">RISK: {evaluation.riskFlags.join(", ") || "なし"}</p>
          <p className="mt-2 text-sm">{evaluation.recommendedAction}</p>
          <p className="mt-3 text-sm font-semibold">
            人間確認: {evaluation.humanReview === "pending_human" ? "待ち" : evaluation.humanReview}
          </p>
        </section>
      ) : null}

      {dossier.inquiryDrafts.length > 0 ? (
        <section className="rounded-xl bg-neutral-50 px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-neutral-400">
            問い合わせ下書き（未送信）
          </p>
          {dossier.inquiryDrafts.map((row, index) => {
            const draft = row as Record<string, unknown>;
            return (
              <div key={index} className="mt-3 text-sm text-neutral-700">
                <p className="font-semibold">{String(draft.subject ?? "")}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] text-neutral-600">
                  {String(draft.body ?? "")}
                </pre>
                <p className="mt-2 text-[11px] text-neutral-400">
                  送信状態: {String(draft.send_status ?? "pending_human")}
                </p>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
