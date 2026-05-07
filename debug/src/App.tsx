import { useState } from "react";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MachineRobotIcon,
  AiBrain02Icon,
  WorkflowCircle03Icon,
  Activity01Icon,
  Link04Icon,
  DashboardSquare01Icon,
  ArrowShrink02Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "../../convex/_generated/api.js";
import { useSocket } from "./lib/useSocket.js";
import { DashboardPanel } from "./components/DashboardPanel.js";
import { AgentsPanel } from "./components/AgentsPanel.js";
import { AutomationsPanel } from "./components/AutomationsPanel.js";
import { MemoryPanel } from "./components/MemoryPanel.js";
import { EventsPanel } from "./components/EventsPanel.js";
import { ConnectionsPanel } from "./components/ConnectionsPanel.js";
import { ConsolidationPanel } from "./components/ConsolidationPanel.js";
import { SettingsPanel } from "./components/SettingsPanel.js";

type View =
  | "dashboard"
  | "agents"
  | "automations"
  | "memory"
  | "events"
  | "consolidation"
  | "connections"
  | "settings";

const NAV_ICONS: Record<View, any> = {
  dashboard: DashboardSquare01Icon,
  agents: MachineRobotIcon,
  automations: WorkflowCircle03Icon,
  memory: AiBrain02Icon,
  events: Activity01Icon,
  consolidation: ArrowShrink02Icon,
  connections: Link04Icon,
  settings: Settings01Icon,
};

const NAV: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "agents", label: "Agents" },
  { id: "automations", label: "Automations" },
  { id: "memory", label: "Memory" },
  { id: "events", label: "Events" },
  { id: "consolidation", label: "Consolidation" },
  { id: "connections", label: "Connections" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const { connected } = useSocket();

  const counts = useQuery(api.memoryRecords.countsByTier, {});
  const agents = useQuery(api.agents.list, {});
  const activeAgentCount = (agents ?? []).filter(
    (a: { status: string }) => a.status === "running" || a.status === "spawned",
  ).length;

  return (
    <div className="h-full flex flex-col font-sans text-locus-ink">
      {/* Top bar — sits transparently on the sky gradient, no fill, no border */}
      <header className="flex items-center justify-between gap-3 px-3 sm:px-6 pt-3 sm:pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-serif text-[18px] tracking-locus text-locus-ink shrink-0">
            Locus
          </h1>
          <div
            className={`flex items-center gap-1.5 text-[12px] ml-1 sm:ml-2 tracking-locus ${
              connected ? "text-locus-brand" : "text-rose-500"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-locus-brand pulse-ring" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  connected ? "bg-locus-brand" : "bg-rose-400"
                }`}
              />
            </span>
            <span className="hidden xs:inline">{connected ? "Live" : "Disconnected"}</span>
          </div>
        </div>

        {counts && (
          <div className="hidden sm:flex items-center gap-4 shrink-0">
            <MetricPill label="Short" value={counts.short} />
            <MetricPill label="Long" value={counts.long} />
            <MetricPill label="Perm" value={counts.permanent} />
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — icon-only on mobile, full labels on md+ */}
        <nav className="w-[60px] md:w-[180px] shrink-0 flex flex-col py-3 gap-1 px-2 md:px-3">
          {NAV.map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                title={item.label}
                className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-full text-left text-[14px] tracking-locus transition-all duration-150 ${
                  isActive
                    ? "bg-locus-card text-locus-brand font-semibold shadow-locus-emboss"
                    : "text-locus-mute hover:text-locus-brand font-normal"
                }`}
              >
                <HugeiconsIcon icon={NAV_ICONS[item.id]} size={18} className="shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
                {item.id === "agents" && activeAgentCount > 0 && (
                  <span className="hidden md:ml-auto md:flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-locus-action text-white">
                    {activeAgentCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-auto px-3 py-3 hidden md:block">
            <span className="text-[10px] text-locus-mute mono">v0.1</span>
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-hidden debug-scroll">
          <div className="h-full overflow-auto debug-scroll p-3 sm:p-5 lg:p-6 fade-in">
            {view === "dashboard" && <DashboardPanel isDark={false} />}
            {view === "agents" && <AgentsPanel isDark={false} />}
            {view === "automations" && <AutomationsPanel isDark={false} />}
            {view === "memory" && <MemoryPanel isDark={false} />}
            {view === "events" && <EventsPanel isDark={false} />}
            {view === "consolidation" && <ConsolidationPanel isDark={false} />}
            {view === "connections" && <ConnectionsPanel isDark={false} />}
            {view === "settings" && <SettingsPanel isDark={false} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] tracking-locus">
      <span className="text-locus-mute">{label}</span>
      <span className="mono font-semibold text-[14px] text-locus-stat">
        {value}
      </span>
    </div>
  );
}
