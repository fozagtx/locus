import "dotenv/config";
import express from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { runAgent, baseOptions } from "./agent.js";
import { startSpectrum } from "./spectrum.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/chat", async (req, res) => {
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt (string) required" });
    return;
  }
  try {
    const text = await runAgent(prompt);
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/chat/stream", async (req, res) => {
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt (string) required" });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    for await (const message of query({ prompt, options: baseOptions })) {
      if (message.type !== "assistant") continue;
      for (const block of message.message.content) {
        if (block.type === "text") res.write(block.text);
      }
    }
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).end((err as Error).message);
    else res.end();
  }
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

startSpectrum().catch((err) => console.error("[spectrum] boot failed", err));
