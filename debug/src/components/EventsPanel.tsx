import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api.js";

const EVENT_COLOR: Record<string, string> = {
  "memory.written": "bg-locus-brand/20 text-locus-brand",
  "memory.recalled": "bg-sky-500/20 text-sky-400",
  "memory.extracted": "bg-violet-500/20 text-violet-400",
  "memory.consolidated": "bg-amber-500/20 text-amber-500",
  "memory.cleaned": "bg-locus-mute/20 text-locus-mute",
};

export function EventsPanel({ isDark }: { isDark: boolean }) {
  const events = useQuery(api.memoryEvents.recent, { limit: 200 });

  const card = isDark
    ? "bg-locus-card/40 border-locus-line"
    : "bg-locus-card border-locus-line shadow-locus-emboss-strong";
  const row = isDark
    ? "bg-locus-card/50 border-locus-line"
    : "bg-locus-card border-locus-line";
  const muted = isDark ? "text-locus-mute" : "text-locus-mute";

  return (
    <div className={`rounded-lg border p-4 ${card}`}>
      <h2 className={`text-xs uppercase tracking-wider mb-3 ${muted}`}>
        Recent events
      </h2>
      {!events ? (
        <div className={`py-6 text-center text-sm ${muted}`}>Loading…</div>
      ) : events.length === 0 ? (
        <div className={`py-6 text-center text-sm ${muted}`}>
          No events yet. Chat with the agent to see memory events stream in.
        </div>
      ) : (
        <div className="space-y-1.5">
          {events.map((e) => (
            <div key={e._id} className={`border rounded-lg p-2.5 ${row}`}>
              <div className="flex items-center gap-2 text-[10px] mono">
                <span
                  className={`px-1.5 py-0.5 rounded ${EVENT_COLOR[e.eventType] ?? "bg-locus-card/50 text-locus-mute"}`}
                >
                  {e.eventType}
                </span>
                {e.conversationId && <span className={muted}>{e.conversationId}</span>}
                {e.memoryId && <span className={muted}>mem:{e.memoryId.slice(-6)}</span>}
                {e.agentId && <span className={muted}>agent:{e.agentId.slice(-6)}</span>}
                <span className={`${muted} ml-auto`}>
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
              </div>
              {e.data && (
                <div
                  className={`text-[11px] mono mt-1 break-all ${isDark ? "text-locus-mute" : "text-locus-mute"}`}
                >
                  {e.data}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
