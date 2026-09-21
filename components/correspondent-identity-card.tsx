import type { CorrespondentIdentity } from "@/lib/ai/correspondent-identity";

export type CorrespondentDeskItem = {
  id: string;
  status: string;
  title: string;
  summary: string | null;
  beat: string | null;
  city: string | null;
  nextAction: string | null;
};

export function CorrespondentByline({
  identity,
}: {
  identity: CorrespondentIdentity;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{identity.displayName}</p>
      <p className="truncate text-[11px] text-neutral-500">{identity.title}</p>
      <p className="truncate text-[11px] text-neutral-400">
        {identity.flag} {identity.city}
      </p>
    </div>
  );
}

export function CorrespondentProfileCard({
  identity,
}: {
  identity: CorrespondentIdentity;
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-neutral-800">{identity.title}</p>
      <p className="text-[11px] text-neutral-500">{identity.titleJa}</p>
      <p className="text-xs text-neutral-600">
        担当：{identity.flag} {identity.territories.join(" / ")}
      </p>
      <p className="text-xs text-neutral-600">
        専門：{[identity.primaryBeat, ...identity.subSpecialties].filter(Boolean).join(" / ")}
      </p>
      {identity.mission ? (
        <p className="text-xs leading-relaxed text-neutral-600">
          Mission：{identity.mission}
        </p>
      ) : null}
    </div>
  );
}

export function CorrespondentDesk({
  items,
}: {
  items: CorrespondentDeskItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
        現在の取材
      </p>
      <ul className="mt-2 space-y-2">
        {items.slice(0, 4).map((item) => (
          <li key={item.id}>
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500">
              {item.status}
              {item.city ? ` · ${item.city}` : ""}
              {item.beat ? ` · ${item.beat}` : ""}
            </p>
            <p className="text-xs text-neutral-800">{item.summary || item.title}</p>
            {item.nextAction ? (
              <p className="text-[11px] text-neutral-500">{item.nextAction}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
