import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";
import { useSocket, type SocketEvent } from "../lib/useSocket.js";

type Phase =
  | "loaded"
  | "proposing"
  | "proposed"
  | "judging"
  | "judged"
  | "applying"
  | "completed"
  | "failed";

interface LivePhase {
  runId: string;
  phase: Phase;
  memoriesCount?: number;
  proposalsCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  mergedCount?: number;
  prunedCount?: number;
  error?: string;
  ts: number;
}

const PHASE_CONFIG: Record<
  string,
  { icon: string; dot: string; color: string; label: string }
> = {
  started: { icon: "🚀", dot: "bg-sky-400", color: "text-sky-400", label: "STARTED" },
  loaded: { icon: "📥", dot: "bg-sky-400", color: "text-sky-400", label: "LOADED MEMORIES" },
  proposing: {
    icon: "📋",
    dot: "bg-locus-brand live-dot",
    color: "text-locus-brand",
    label: "PROPOSER THINKING",
  },
  proposed: {
    icon: "📋",
    dot: "bg-locus-brand",
    color: "text-locus-brand",
    label: "PROPOSALS",
  },
  judging: {
    icon: "⚖️",
    dot: "bg-amber-500 live-dot",
    color: "text-amber-500",
    label: "JUDGE DELIBERATING",
  },
  judged: { icon: "⚖️", dot: "bg-amber-500", color: "text-amber-500", label: "VERDICT" },
  applying: { icon: "🔧", dot: "bg-cyan-400", color: "text-cyan-400", label: "APPLYING" },
  completed: {
    icon: "🏁",
    dot: "bg-locus-brand",
    color: "text-locus-brand",
    label: "COMPLETED",
  },
  failed: { icon: "❌", dot: "bg-rose-400", color: "text-rose-400", label: "FAILED" },
};

function timeAgo(ts?: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function ConsolidationPanel({ isDark }: { isDark: boolean }) {
  const runs = useQuery(api.consolidation.listRuns, { limit: 50 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [livePhases, setLivePhases] = useState<Record<string, LivePhase[]>>({});
  const [triggering, setTriggering] = useState(false);

  useSocket((evt: SocketEvent) => {
    if (
      evt.event === "consolidation_started" ||
      evt.event === "consolidation_phase" ||
      evt.event === "consolidation_completed" ||
      evt.event === "consolidation_failed"
    ) {
      const data = evt.data as any;
      const id = data.runId;
      if (!id) return;
      let phase: Phase;
      if (evt.event === "consolidation_started") phase = "loaded";
      else if (evt.event === "consolidation_completed") phase = "completed";
      else if (evt.event === "consolidation_failed") phase = "failed";
      else phase = data.phase as Phase;
      setLivePhases((prev) => {
        const next = { ...prev };
        next[id] = [
          ...(prev[id] ?? []),
          { ...data, phase, runId: id, ts: evt.at },
        ];
        return next;
      });
    }
  });

  async function triggerManual() {
    setTriggering(true);
    try {
      await fetch("/api/consolidate", { method: "POST" });
    } finally {
      setTimeout(() => setTriggering(false), 1500);
    }
  }

  const list = runs ?? [];
  const cardBg = isDark
    ? "bg-locus-card/40 border-locus-line/60"
    : "bg-locus-card border-locus-line shadow-locus-emboss-strong";
  const hoverBg = isDark ? "hover:bg-locus-card/40" : "hover:bg-locus-card";
  const muted = isDark ? "text-locus-mute" : "text-locus-mute";

  if (selectedId) {
    return (
      <ConsolidationDetail
        runId={selectedId}
        phases={livePhases[selectedId] ?? []}
        onBack={() => setSelectedId(null)}
        isDark={isDark}
      />
    );
  }

  return (
    <div className="flex flex-col h-full -m-5">
      <div
        className={`shrink-0 border-b px-5 py-3 flex items-center gap-3 ${
          isDark ? "border-locus-line" : "border-locus-line"
        }`}
      >
        <h2
          className={`text-xs font-semibold uppercase tracking-wider ${
            isDark ? "text-locus-mute" : "text-locus-mute"
          }`}
        >
          Memory Consolidation
        </h2>
        <span className={`text-xs mono ${muted}`}>
          {list.length} run{list.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={triggerManual}
          disabled={triggering}
          className="ml-auto h-9 px-4 text-[14px] font-semibold tracking-locus rounded-full bg-locus-card text-locus-brand shadow-locus-emboss hover:text-locus-ink transition-colors disabled:opacity-50"
        >
          {triggering ? "Running…" : "Run now"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto debug-scroll p-4 space-y-3">
        {runs === undefined ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className={`h-20 rounded-xl border ${cardBg} shimmer`} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div
            className={`text-sm py-8 text-center ${
              isDark ? "text-locus-mute" : "text-locus-mute"
            }`}
          >
            No consolidation runs yet. The loop runs daily, or hit "Run now" to
            trigger one.
            <p className={`text-xs mt-2 ${muted}`}>
              Consolidation reviews your memories for duplicates and
              contradictions, merges or prunes via a proposer → judge pipeline.
            </p>
          </div>
        ) : (
          list.map((run: any) => {
            const isActive = run.status === "running";
            const statusCfg =
              run.status === "completed"
                ? PHASE_CONFIG.completed
                : run.status === "failed"
                  ? PHASE_CONFIG.failed
                  : PHASE_CONFIG.started;
            const durationMs =
              run.completedAt && run.startedAt
                ? run.completedAt - run.startedAt
                : Date.now() - run.startedAt;
            return (
              <div
                key={run._id}
                onClick={() => setSelectedId(run.runId)}
                className={`border rounded-xl p-4 cursor-pointer transition-all duration-150 fade-in ${cardBg} ${hoverBg}`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {isActive && (
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full ${statusCfg.dot} pulse-ring`}
                      />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusCfg.dot}`}
                    />
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isDark ? "text-locus-ink" : "text-locus-ink"
                    }`}
                  >
                    {statusCfg.label}
                  </span>
                  <span className={`text-[10px] mono ${muted}`}>
                    trigger: {run.trigger}
                  </span>
                  <span className={`text-xs ml-auto mono ${muted}`}>
                    {timeAgo(run.startedAt)} · {(durationMs / 1000).toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center gap-4 ml-5 text-[11px] mono">
                  <Metric
                    label="proposals"
                    value={run.proposalsCount}
                    color={isDark ? "text-locus-brand" : "text-locus-brand"}
                  />
                  <Metric
                    label="merged"
                    value={run.mergedCount}
                    color={isDark ? "text-sky-400" : "text-sky-600"}
                  />
                  <Metric
                    label="pruned"
                    value={run.prunedCount}
                    color={isDark ? "text-rose-400" : "text-rose-600"}
                  />
                  {run.notes && (
                    <span className={`${muted} truncate`}>{run.notes}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span>
      <span className={color}>{value ?? 0}</span>
      <span className="opacity-60 ml-1">{label}</span>
    </span>
  );
}

function ConsolidationDetail({
  runId,
  phases,
  onBack,
  isDark,
}: {
  runId: string;
  phases: LivePhase[];
  onBack: () => void;
  isDark: boolean;
}) {
  const runs = useQuery(api.consolidation.listRuns, { limit: 80 });
  const run = runs?.find((r: any) => r.runId === runId);
  const [allPhases, setAllPhases] = useState<LivePhase[]>(phases);

  // Keep absorbing live phases that arrive while the detail is open
  useSocket((evt: SocketEvent) => {
    const data = evt.data as any;
    if (data?.runId !== runId) return;
    if (
      evt.event === "consolidation_phase" ||
      evt.event === "consolidation_started" ||
      evt.event === "consolidation_completed" ||
      evt.event === "consolidation_failed"
    ) {
      let phase: Phase;
      if (evt.event === "consolidation_started") phase = "loaded";
      else if (evt.event === "consolidation_completed") phase = "completed";
      else if (evt.event === "consolidation_failed") phase = "failed";
      else phase = data.phase as Phase;
      setAllPhases((prev) => [...prev, { ...data, phase, runId, ts: evt.at }]);
    }
  });

  useEffect(() => {
    setAllPhases(phases);
  }, [runId]);

  const muted = isDark ? "text-locus-mute" : "text-locus-mute";

  if (!run) {
    return (
      <div className="p-5">
        <button
          onClick={onBack}
          className={`text-xs rounded-md px-2.5 py-1 mb-3 ${
            isDark
              ? "text-locus-mute bg-locus-card"
              : "text-locus-mute bg-locus-card"
          }`}
        >
          ← Back
        </button>
        <div
          className={`text-sm ${isDark ? "text-locus-mute" : "text-locus-mute"}`}
        >
          Loading run {runId}…
        </div>
      </div>
    );
  }

  const statusCfg =
    run.status === "completed"
      ? PHASE_CONFIG.completed
      : run.status === "failed"
        ? PHASE_CONFIG.failed
        : PHASE_CONFIG.started;

  return (
    <div className="flex flex-col h-full -m-5 fade-in">
      <div
        className={`shrink-0 border-b px-5 py-3 flex items-center gap-3 ${
          isDark ? "border-locus-line" : "border-locus-line"
        }`}
      >
        <button
          onClick={onBack}
          className={`text-xs rounded-md px-2.5 py-1 transition-colors ${
            isDark
              ? "text-locus-mute hover:text-locus-ink bg-locus-card hover:bg-locus-card"
              : "text-locus-mute hover:text-locus-mute bg-locus-card hover:bg-locus-card"
          }`}
        >
          ← Back
        </button>
        <span
          className={`relative flex h-2.5 w-2.5 shrink-0 ${statusCfg.color}`}
        >
          {run.status === "running" && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${statusCfg.dot} pulse-ring`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusCfg.dot}`}
          />
        </span>
        <span
          className={`text-sm font-medium ${
            isDark ? "text-locus-ink" : "text-locus-ink"
          }`}
        >
          Consolidation {runId.slice(-6)}
        </span>
        <span className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</span>
        <span className={`text-xs mono ml-auto ${muted}`}>
          trigger: {run.trigger}
        </span>
      </div>

      <div
        className={`shrink-0 border-b px-5 py-3 grid grid-cols-4 gap-4 text-center ${
          isDark ? "border-locus-line/60" : "border-locus-line"
        }`}
      >
        <SummaryStat
          label="proposals"
          value={run.proposalsCount}
          color="text-locus-brand"
          isDark={isDark}
        />
        <SummaryStat
          label="merged"
          value={run.mergedCount}
          color="text-sky-400"
          isDark={isDark}
        />
        <SummaryStat
          label="pruned"
          value={run.prunedCount}
          color="text-rose-400"
          isDark={isDark}
        />
        <SummaryStat
          label="duration"
          value={
            run.completedAt && run.startedAt
              ? `${((run.completedAt - run.startedAt) / 1000).toFixed(1)}s`
              : "…"
          }
          color={isDark ? "text-locus-ink" : "text-locus-mute"}
          isDark={isDark}
        />
      </div>

      <div className="flex-1 overflow-y-auto debug-scroll p-5 space-y-6">
        {/* Pipeline timeline (live + historical) */}
        <section>
          <div
            className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${muted}`}
          >
            Pipeline Timeline
          </div>
          {allPhases.length === 0 ? (
            <div className={`text-sm ${muted}`}>
              {run.status === "completed" || run.status === "failed"
                ? "Phase events stream live; this run already finished. The full result is preserved below."
                : "Waiting for phase events…"}
            </div>
          ) : (
            <div className="space-y-0">
              {allPhases.map((p, i) => {
                const cfg = PHASE_CONFIG[p.phase] ?? PHASE_CONFIG.started;
                const isLast = i === allPhases.length - 1;
                return (
                  <div key={`${p.ts}-${i}`} className="flex gap-3 slide-down">
                    <div className="flex flex-col items-center shrink-0 w-5">
                      <div className="mt-1.5 text-[14px] leading-none">
                        {cfg.icon}
                      </div>
                      {!isLast && (
                        <div
                          className={`flex-1 w-px mt-1 ${
                            isDark ? "bg-locus-card" : "bg-locus-card"
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`text-[10px] font-bold mono tracking-wider ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        <span className={`text-[10px] mono ${muted}`}>
                          {new Date(p.ts).toLocaleTimeString()}
                        </span>
                      </div>
                      <div
                        className={`text-xs ${
                          isDark ? "text-locus-mute" : "text-locus-mute"
                        } mono`}
                      >
                        {p.memoriesCount !== undefined &&
                          `memories scanned: ${p.memoriesCount}`}
                        {p.proposalsCount !== undefined &&
                          `proposals: ${p.proposalsCount}`}
                        {p.approvedCount !== undefined &&
                          `approved: ${p.approvedCount} · rejected: ${p.rejectedCount ?? 0}`}
                        {p.mergedCount !== undefined &&
                          `merged: ${p.mergedCount} · pruned: ${p.prunedCount ?? 0}`}
                        {p.error && (
                          <span className="text-rose-400">{p.error}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Stored reasoning — proposals + decisions + applied */}
        <ReasoningSection run={run} isDark={isDark} />

        {run.notes && (
          <section>
            <div
              className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${muted}`}
            >
              Notes
            </div>
            <div
              className={`text-xs ${
                isDark ? "text-locus-mute" : "text-locus-mute"
              }`}
            >
              {run.notes}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ReasoningSection({ run, isDark }: { run: any; isDark: boolean }) {
  const muted = isDark ? "text-locus-mute" : "text-locus-mute";
  let details: any = null;
  try {
    details = run.details ? JSON.parse(run.details) : null;
  } catch {
    /* invalid JSON */
  }

  if (!details || !details.proposals?.length) {
    return (
      <section>
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${muted}`}
        >
          Proposals & Decisions
        </div>
        <div className={`text-sm ${muted}`}>
          {run.status === "running"
            ? "Proposals will appear here when the proposer finishes."
            : run.proposalsCount === 0
              ? "Proposer found nothing to change."
              : "No stored reasoning for this run (this was likely a pre-upgrade run)."}
        </div>
      </section>
    );
  }

  const decisions: any[] = details.decisions ?? [];
  const applied: any[] = details.applied ?? [];
  const snapshots: Record<string, { content: string; segment: string; tier: string }> =
    details.memorySnapshots ?? {};
  const decisionByIdx = new Map<number, any>();
  for (const d of decisions) decisionByIdx.set(d.proposalIndex, d);
  const appliedByIdx = new Set<number>(applied.map((a) => a.proposalIndex));

  const renderRef = (id: string) => (
    <MemoryRef id={id} snap={snapshots[id]} isDark={isDark} />
  );
  const renderRefList = (ids: string[]) =>
    ids.length === 0 ? (
      <span className={muted}>(none)</span>
    ) : (
      <div className="space-y-1 mt-0.5">
        {ids.map((id) => (
          <div key={id}>{renderRef(id)}</div>
        ))}
      </div>
    );

  return (
    <section>
      <div
        className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${muted}`}
      >
        Proposals & Decisions · {details.proposals.length} total
      </div>
      <div className="space-y-2">
        {details.proposals.map((p: any, idx: number) => {
          const d = decisionByIdx.get(idx);
          const wasApplied = appliedByIdx.has(idx);
          const outcome =
            !d
              ? { label: "NO DECISION", color: "text-locus-mute", bg: "bg-locus-mute/10", border: "border-slate-500/20" }
              : d.approve && wasApplied
                ? { label: "APPLIED", color: "text-locus-brand", bg: "bg-locus-brand/10", border: "border-locus-brand/20" }
                : d.approve
                  ? { label: "APPROVED (skipped)", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" }
                  : { label: "REJECTED", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };

          return (
            <div
              key={idx}
              className={`border rounded-lg p-3 ${
                isDark
                  ? "bg-locus-card/50 border-locus-line"
                  : "bg-locus-card border-locus-line"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold mono ${outcome.color} ${outcome.bg} ${outcome.border}`}
                >
                  {outcome.label}
                </span>
                <span
                  className={`text-[10px] mono uppercase ${
                    isDark ? "text-locus-mute" : "text-locus-mute"
                  }`}
                >
                  {p.type}
                </span>
                <span className={`text-[10px] mono ml-auto ${muted}`}>
                  #{idx}
                </span>
              </div>

              {/* Proposal body */}
              <div className={`text-xs space-y-1 mono`}>
                {p.type === "merge" && (
                  <>
                    <div className={isDark ? "text-locus-ink" : "text-locus-mute"}>
                      <span className={muted}>keep:</span>
                      <div className="mt-0.5">{p.keep && renderRef(p.keep)}</div>
                    </div>
                    <div className={isDark ? "text-locus-ink" : "text-locus-mute"}>
                      <span className={muted}>absorb:</span>
                      {renderRefList(p.absorb ?? [])}
                    </div>
                    {p.rewriteContent && (
                      <div
                        className={`mt-1 p-2 rounded ${
                          isDark ? "bg-locus-card/60 text-locus-ink" : "bg-white text-locus-mute"
                        } text-[11px]`}
                      >
                        → {p.rewriteContent}
                      </div>
                    )}
                  </>
                )}
                {p.type === "supersede" && (
                  <>
                    <div className={isDark ? "text-locus-ink" : "text-locus-mute"}>
                      <span className={muted}>newer:</span>
                      <div className="mt-0.5">{p.newer && renderRef(p.newer)}</div>
                    </div>
                    <div className={isDark ? "text-locus-ink" : "text-locus-mute"}>
                      <span className={muted}>older:</span>
                      {renderRefList(p.older ?? [])}
                    </div>
                  </>
                )}
                {p.type === "prune" && (
                  <>
                    <div className={isDark ? "text-locus-ink" : "text-locus-mute"}>
                      <span className={muted}>memoryId:</span>
                      <div className="mt-0.5">{p.memoryId && renderRef(p.memoryId)}</div>
                    </div>
                    {p.reason && (
                      <div className={isDark ? "text-locus-mute" : "text-locus-mute"}>
                        <span className={muted}>reason:</span> {p.reason}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Judge rationale */}
              {d && (
                <div
                  className={`mt-2 pt-2 border-t text-[11px] ${
                    isDark
                      ? "border-locus-line text-locus-mute"
                      : "border-locus-line text-locus-mute"
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold mono ${
                      d.approve
                        ? isDark
                          ? "text-locus-brand"
                          : "text-locus-brand"
                        : isDark
                          ? "text-rose-400"
                          : "text-rose-600"
                    }`}
                  >
                    JUDGE{" "}
                  </span>
                  {d.rationale}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  color,
  isDark,
}: {
  label: string;
  value: number | string;
  color: string;
  isDark: boolean;
}) {
  return (
    <div>
      <div className={`text-xl font-bold mono ${color}`}>{value ?? 0}</div>
      <div className={`text-[10px] uppercase tracking-wider ${isDark ? "text-locus-mute" : "text-locus-mute"}`}>
        {label}
      </div>
    </div>
  );
}

function MemoryRef({
  id,
  snap,
  isDark,
}: {
  id: string;
  snap?: { content: string; segment: string; tier: string };
  isDark: boolean;
}) {
  const muted = isDark ? "text-locus-mute" : "text-locus-mute";
  const idColor = isDark ? "text-locus-mute" : "text-locus-mute";
  const contentColor = isDark ? "text-locus-ink" : "text-locus-ink";
  const tagColor = isDark ? "text-sky-400" : "text-sky-600";

  if (!snap) {
    return (
      <span className={`text-[11px] mono ${idColor}`}>
        {id} <span className={muted}>· (no snapshot)</span>
      </span>
    );
  }

  return (
    <div
      className={`rounded border px-2 py-1.5 ${
        isDark ? "bg-locus-card/40 border-locus-line/80" : "bg-locus-card border-locus-line shadow-locus-emboss-strong"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-[10px] mono ${idColor}`}>{id}</span>
        <span className={`text-[9px] mono uppercase ${tagColor}`}>
          {snap.tier}/{snap.segment}
        </span>
      </div>
      <div className={`text-[11px] ${contentColor}`}>{snap.content}</div>
    </div>
  );
}
