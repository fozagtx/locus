import "./env-setup.js";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { WebSocketServer } from "ws";
import { addClient } from "./broadcast.js";
import { startSpectrum } from "./spectrum.js";
import { handleUserMessage } from "./interaction-agent.js";
import { loadIntegrations } from "./integrations/registry.js";
import { startCleanupLoop } from "./memory/clean.js";
import { startAutomationLoop } from "./automations.js";
import { startHeartbeatLoop } from "./heartbeat.js";
import { startConsolidationLoop } from "./consolidation.js";
import { cancelAgent, retryAgent } from "./execution-agent.js";
import { createComposioRouter } from "./composio-routes.js";
import { ensureProactiveWatcher } from "./proactive-email.js";
import { preloadLocalModel } from "./embeddings.js";
import { createMemoryRouter } from "./memory-routes.js";

const here = dirname(fileURLToPath(import.meta.url));
const debugDist = resolve(here, "..", "debug", "dist");

const app = express();
app.use(cors());

// Composio webhook receiver must read raw bytes for HMAC verification, so its
// body parser is mounted BEFORE the global express.json. Without this ordering
// the JSON parser consumes the stream first and the raw buffer arrives empty.
app.use("/composio/webhook", express.raw({ type: "application/json", limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));

// The debug UI calls /api/* (matches Vite's dev proxy convention). In
// production we serve the SPA from the same origin, so strip the prefix and
// route to the underlying handlers (/composio, /memory, /chat, …).
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "locus" });
});

// Root route — gives Railway's default healthcheck something to hit and points
// humans at the debug dashboard.
app.get("/", (_req, res) => {
  if (existsSync(debugDist)) {
    res.redirect("/debug/");
  } else {
    res.json({ ok: true, service: "locus" });
  }
});

// Serve the debug dashboard under /debug if it has been built. Built by
// `pnpm build:debug` (Vite, output: debug/dist). On Railway this runs as part
// of `pnpm start`. Locally during development, run `pnpm dev` instead — Vite
// serves the UI directly at :5173 with HMR.
if (existsSync(debugDist)) {
  app.use("/debug", express.static(debugDist));
  // SPA fallback — runs for any /debug/* request that didn't match a static
  // file. Express 5 (path-to-regexp v8) rejects bare `*` wildcards in route
  // patterns, so this is expressed as a plain middleware mounted on /debug.
  app.use("/debug", (_req, res) => {
    res.sendFile(resolve(debugDist, "index.html"));
  });
}

app.use("/composio", createComposioRouter());
app.use("/memory", createMemoryRouter());

app.post("/agents/:id/cancel", (req, res) => {
  const ok = cancelAgent(req.params.id);
  res.json({ ok });
});

app.post("/consolidate", async (_req, res) => {
  try {
    const { runConsolidation } = await import("./consolidation.js");
    // Fire-and-forget so the HTTP request returns immediately.
    runConsolidation("manual").catch((err) =>
      console.error("[consolidation] manual run failed", err),
    );
    res.json({ ok: true, triggered: "manual" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/agents/:id/retry", async (req, res) => {
  const result = await retryAgent(req.params.id);
  if (!result) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  res.json(result);
});

// Chat endpoint for local testing and the debug dashboard
app.post("/chat", async (req, res) => {
  const { conversationId, content } = req.body ?? {};
  if (!conversationId || !content) {
    res.status(400).json({ error: "conversationId and content required" });
    return;
  }
  try {
    const reply = await handleUserMessage({ conversationId, content });
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  addClient(ws);
  ws.send(JSON.stringify({ event: "hello", data: { ok: true }, at: Date.now() }));
});

const port = Number(process.env.PORT ?? 3456);
// Bind explicitly to 0.0.0.0 so Railway's IPv4 proxy can reach us. Without
// this, Node binds to :: (IPv6 only) on dual-stack containers and the edge
// proxy returns 502 "Application failed to respond".
server.listen(port, "0.0.0.0", () => {
  console.log(`locus server listening on :${port}`);
  console.log(`  health      GET  http://localhost:${port}/health`);
  console.log(`  chat        POST http://localhost:${port}/chat`);
  console.log(`  websocket   WS   ws://localhost:${port}/ws`);

  // Heavy startup work runs AFTER the server is already listening, so the
  // healthcheck passes immediately even if Spectrum / Composio / embeddings
  // are slow to initialize. Each branch is wrapped in a catch so one failure
  // can't tear down the whole process.
  loadIntegrations().catch((err) => console.error("[integrations] load failed", err));
  startCleanupLoop();
  startAutomationLoop();
  startHeartbeatLoop();
  startConsolidationLoop();
  preloadLocalModel();

  startSpectrum().catch((err) => console.error("[spectrum] boot failed", err));

  const stableUrl = process.env.PUBLIC_URL;
  if (stableUrl && !stableUrl.includes("localhost")) {
    ensureProactiveWatcher(stableUrl).catch((err) =>
      console.error("[proactive] startup failed", err),
    );
  }
});
