"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { authHeaders } from "@/lib/auth/client-headers";
import { HEALTH_DOT, HEALTH_LABEL, hoursAgoLabel } from "@/lib/ai/control-tower/health";
import { errorKindLabel } from "@/lib/ai/control-tower/errors";
import { flagEmoji } from "@/lib/world/labels";
import type { ControlTowerSnapshot } from "@/lib/ai/control-tower/types";

const ACTIONS = [
  { id: "run_ai", label: "Run AI Now" },
  { id: "run_scout", label: "Run World Scout" },
  { id: "run_hunter", label: "Run Product Hunter" },
  { id: "retry_failed", label: "Retry Failed" },
] as const;

export function AiControlTower() {
  const [snapshot, setSnapshot] = useState<ControlTowerSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/ai-control", {
      headers: await authHeaders(),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "読み込みに失敗しました");
      setSnapshot(null);
      return;
    }
    setError("");
    setSnapshot(body as ControlTowerSnapshot);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load + poll
  }, []);

  async function runAction(action: string) {
    setBusy(action);
    try {
      const response = await fetch("/api/admin/ai-control", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "実行に失敗しました",
        );
      }
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "実行に失敗しました");
    } finally {
      setBusy("");
    }
  }

  const generated = snapshot
    ? new Date(snapshot.generatedAt).toLocaleString("ja-JP")
    : "";

  return (
    <div className="space-y-6">
      <AdminNav current="ai" />
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500">
          NEWFIND
        </p>
        <h1 className="text-2xl font-semibold">AI CONTROL TOWER</h1>
        <p className="text-sm text-neutral-500">
          AIが本当に活動しているかを監視する。サーバーが生きているだけでは🟢にしない。
        </p>
        {generated ? (
          <p className="text-xs text-neutral-400">Updated {generated}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={Boolean(busy) || snapshot?.running}
            onClick={() => void runAction(item.id)}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy === item.id ? "Running…" : item.label}
          </button>
        ))}
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void runAction(snapshot?.paused ? "resume" : "pause")}
          className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-40"
        >
          {snapshot?.paused ? "Resume AI" : "Pause AI"}
        </button>
      </div>

      {!snapshot ? (
        <p className="text-sm text-neutral-400">読み込み中...</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.system.map((node) => (
              <div
                key={node.id}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-4"
              >
                <p className="text-sm font-semibold">
                  {HEALTH_DOT[node.level]} {node.label}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                  {HEALTH_LABEL[node.level]}
                </p>
                <p className="mt-2 text-sm text-neutral-700">
                  {node.id === "ai_engine"
                    ? `最終実行：${hoursAgoLabel(node.lastAt)}`
                    : node.id === "world_scout"
                      ? `最終探索：${hoursAgoLabel(node.lastAt)}`
                      : node.id === "product_hunter"
                        ? `最終発見：${hoursAgoLabel(node.lastAt)}`
                        : node.detail}
                </p>
                {node.id === "ai_posts" || node.id === "database" || node.id === "cron" ? (
                  <p className="mt-1 text-xs text-neutral-500">{node.detail}</p>
                ) : null}
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h2 className="text-sm font-semibold">SYSTEM HEALTH / ACTIVITY / TODAY</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-neutral-500">ACTIVITY</p>
                <ul className="mt-1 space-y-1 text-sm">
                  <li>Last discovery: {hoursAgoLabel(snapshot.activity.lastDiscoveryAt)}</li>
                  <li>Last post: {hoursAgoLabel(snapshot.activity.lastPostAt)}</li>
                  <li>Last reaction: {hoursAgoLabel(snapshot.activity.lastReactionAt)}</li>
                  <li>Last scout run: {hoursAgoLabel(snapshot.activity.lastScoutRunAt)}</li>
                </ul>
              </div>
              <div>
                <p className="text-xs text-neutral-500">TODAY</p>
                <ul className="mt-1 space-y-1 text-sm">
                  <li>Scouts / searches: {snapshot.today.scouts}</li>
                  <li>Candidates: {snapshot.today.candidates}</li>
                  <li>Verified discoveries: {snapshot.today.verified}</li>
                  <li>AI posts: {snapshot.today.posts}</li>
                  <li>AI reactions: {snapshot.today.reactions}</li>
                </ul>
              </div>
              <div>
                <p className="text-xs text-neutral-500">CRON / ERRORS</p>
                <ul className="mt-1 space-y-1 text-sm">
                  <li>Last scheduled: {hoursAgoLabel(snapshot.cron.lastScheduledAt)}</li>
                  <li>Last success: {hoursAgoLabel(snapshot.cron.lastSuccessAt)}</li>
                  <li>Last failed: {hoursAgoLabel(snapshot.cron.lastFailedAt)}</li>
                  <li>Consecutive failures: {snapshot.counters.consecutiveFailures}</li>
                  <li>NO ACTION today: {snapshot.counters.noActionCount}</li>
                </ul>
              </div>
            </div>
            {snapshot.lastError.message ? (
              <p className="mt-3 text-sm text-red-700">
                最終エラー（{errorKindLabel(snapshot.lastError.kind)}）:{" "}
                {snapshot.lastError.message}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h2 className="text-sm font-semibold">ALERT</h2>
            {snapshot.alerts.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">現在なし</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {snapshot.alerts.map((alert) => (
                  <li
                    key={alert.code}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      alert.level === "red"
                        ? "bg-red-50 text-red-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {alert.level === "red" ? "🔴" : "🟡"} {alert.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h2 className="text-sm font-semibold">AI RESIDENTS</h2>
            <div className="mt-3 space-y-2">
              {snapshot.residents.map((resident) => (
                <div
                  key={resident.personaId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {resident.countryCode ? `${flagEmoji(resident.countryCode)} ` : ""}
                      {resident.name}
                      <span className="ml-2 text-xs font-normal text-neutral-500">
                        {resident.role}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      Last action: {hoursAgoLabel(resident.lastActionAt)}
                      {resident.lastAction ? ` · ${resident.lastAction}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-neutral-600">
                    <p>
                      {HEALTH_DOT[resident.level]} {HEALTH_LABEL[resident.level]}
                    </p>
                    <p>
                      Discoveries: {resident.discoveries} · Posts: {resident.posts} ·
                      Reactions: {resident.reactions}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h2 className="text-sm font-semibold">AI ACTIVITY LOG</h2>
            {snapshot.logs.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">まだ記録がありません</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snapshot.logs.map((log) => (
                  <li key={log.id} className="border-b border-gray-100 pb-2 text-sm last:border-0">
                    <span className="text-xs text-neutral-400">
                      {new Date(log.occurredAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="ml-2 font-medium">{log.actorName}</span>
                    <span className="ml-2 text-neutral-500">{log.action}</span>
                    {log.detail ? (
                      <p className="mt-0.5 text-neutral-700">{log.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
