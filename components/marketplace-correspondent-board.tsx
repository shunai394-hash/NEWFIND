import Link from "next/link";
import {
  MARKETPLACE_CORRESPONDENTS,
  MARKETPLACE_LABELS,
} from "@/lib/marketplace";
import { createMarketplaceAdapters, marketplaceAdapterStatus } from "@/lib/marketplace/adapters";
import {
  loadMarketplaceCorrespondentStatuses,
  type CorrespondentStatusRow,
} from "@/lib/marketplace/store";
import { lookupNamedWorldResident } from "@/lib/ai/named-world-residents";
import { Avatar } from "@/components/avatar";

function statusFor(
  id: string,
  rows: CorrespondentStatusRow[],
): CorrespondentStatusRow | null {
  return rows.find((row) => row.correspondentId === id) ?? null;
}

export async function MarketplaceCorrespondentBoard() {
  const rows = await loadMarketplaceCorrespondentStatuses();
  const adapters = marketplaceAdapterStatus(createMarketplaceAdapters());

  return (
    <section className="mb-10">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400">
        MARKETPLACE CORRESPONDENTS
      </p>
      <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">
        マーケットプレイス専任特派員
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
        公式APIが使える市場だけ探索します。出品者は仕入れ先ではありません。外部発注・営業メールは自動送信しません。
      </p>
      <ul className="mt-4 space-y-3">
        {MARKETPLACE_CORRESPONDENTS.map((spec) => {
          const named = lookupNamedWorldResident(spec.username);
          const stats = statusFor(spec.id, rows);
          const adapter = adapters.find((item) => item.marketplace === spec.marketplace);
          return (
            <li key={spec.id}>
              <Link
                href={`/u/${spec.username}`}
                className="block rounded-2xl border border-neutral-200 px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    profile={{
                      displayName: spec.name,
                      avatarUrl: named?.avatarUrl ?? null,
                    }}
                    size={42}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{spec.name}</p>
                    <p className="text-[12px] text-neutral-600">
                      {MARKETPLACE_LABELS[spec.marketplace]}
                      {adapter?.enabled ? " · API接続中" : " · API未設定（探索停止）"}
                    </p>
                    {!adapter?.enabled && adapter?.reason ? (
                      <p className="mt-1 text-[11px] text-neutral-400">{adapter.reason}</p>
                    ) : null}
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-600 sm:grid-cols-4">
                      <div>
                        <dt className="text-neutral-400">最終探索</dt>
                        <dd>{stats?.lastSearchAt?.slice(0, 16) ?? "未実行"}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">発見</dt>
                        <dd>{stats?.discovered ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">有力</dt>
                        <dd>{stats?.strong ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">WATCH</dt>
                        <dd>{stats?.watch ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">INVESTIGATE</dt>
                        <dd>{stats?.investigate ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">除外</dt>
                        <dd>{stats?.disqualified ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">学習</dt>
                        <dd>{stats?.learningCount ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">情報源</dt>
                        <dd>{adapter?.enabled ? "official_api" : "取得できず"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
