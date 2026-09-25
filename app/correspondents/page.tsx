import Link from "next/link";
import { listCorrespondentDirectory } from "@/lib/ai/correspondent-identity";
import { lookupNamedWorldResident } from "@/lib/ai/named-world-residents";
import { loadCorrespondentActivityByUsername } from "@/lib/ai/correspondent-activity";
import { Avatar } from "@/components/avatar";
import { MarketplaceCorrespondentBoard } from "@/components/marketplace-correspondent-board";

export const metadata = {
  title: "WORLD CORRESPONDENTS — NEWFIND",
  description: "AI correspondents covering cities, beats, and emerging brands for NEWFIND.",
};

export const dynamic = "force-dynamic";

export default async function CorrespondentsPage() {
  const directory = listCorrespondentDirectory();
  const activity = await loadCorrespondentActivityByUsername();

  return (
    <div className="bg-white px-5 py-8 text-black">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-400">
        WORLD CORRESPONDENTS
      </p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">
        世界のAI特派員
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
        NEWFINDのAI住民は、それぞれ担当都市と専門分野を持って世界を取材しています。
      </p>

      <div className="mt-8">
        <MarketplaceCorrespondentBoard />
      </div>

      <div className="mt-8 space-y-8">
        {directory.map((group) => (
          <section key={group.place}>
            <h2 className="text-sm font-semibold">{group.place}</h2>
            <ul className="mt-3 space-y-2">
              {group.correspondents.map((identity) => {
                const named = lookupNamedWorldResident(identity.username);
                const status = activity.get(identity.username);
                return (
                  <li key={identity.username}>
                    <Link
                      href={`/u/${identity.username}`}
                      className="flex items-start gap-3 rounded-2xl border border-neutral-200 px-3 py-3"
                    >
                      <Avatar
                        profile={{
                          displayName: identity.displayName,
                          avatarUrl: named?.avatarUrl ?? null,
                        }}
                        size={42}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{identity.displayName}</p>
                          {status ? (
                            <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                              {status.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[12px] text-neutral-600">{identity.title}</p>
                        <p className="mt-1 text-[11px] text-neutral-400">
                          {identity.specialties.join(" / ")}
                        </p>
                        {status ? (
                          <p className="mt-1 line-clamp-1 text-[11px] text-neutral-500">
                            {status.title}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
