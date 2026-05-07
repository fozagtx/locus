import { Spectrum, type SpectrumInstance } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { api } from "../convex/_generated/api.js";
import { convex } from "./convex-client.js";
import { handleUserMessage } from "./interaction-agent.js";
import { broadcast } from "./broadcast.js";

const MAX_CHUNK = 2900;

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?|```/g, ""))
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .trim();
}

function chunk(text: string, size = MAX_CHUNK): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let buf = "";
  for (const line of text.split(/\n/)) {
    if ((buf + "\n" + line).length > size) {
      if (buf) out.push(buf);
      buf = line;
    } else {
      buf = buf ? buf + "\n" + line : line;
    }
  }
  if (buf) out.push(buf);
  return out;
}

let app: SpectrumInstance | null = null;

export async function startSpectrum(): Promise<void> {
  if (process.env.SPECTRUM_ENABLED !== "1") {
    console.log("[spectrum] disabled (set SPECTRUM_ENABLED=1 to boot)");
    return;
  }

  const projectId = process.env.SPECTRUM_PROJECT_ID;
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.warn("[spectrum] SPECTRUM_PROJECT_ID/SECRET missing — skipping");
    return;
  }

  app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });
  console.log("[spectrum] booted with iMessage provider");

  (async () => {
    if (!app) return;
    for await (const [space, message] of app.messages) {
      if (!imessage.is(space)) continue;
      if (message.content.type !== "text") continue;

      const content = message.content.text;
      const phone = space.phone;
      const conversationId = `sms:${phone}`;
      const turnTag = Math.random().toString(36).slice(2, 8);
      const preview = content.length > 100 ? content.slice(0, 100) + "…" : content;
      console.log(`[turn ${turnTag}] ← ${phone}: ${JSON.stringify(preview)}`);
      const start = Date.now();

      broadcast("message_in", { conversationId, content, from_number: phone });

      try {
        await space.responding(async () => {
          const reply = await handleUserMessage({
            conversationId,
            content,
            turnTag,
            onThinking: (t) => broadcast("thinking", { conversationId, t }),
          });
          if (!reply) {
            console.log(`[turn ${turnTag}] → (no reply)`);
            return;
          }
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          const replyPreview = reply.length > 100 ? reply.slice(0, 100) + "…" : reply;
          console.log(
            `[turn ${turnTag}] → reply (${elapsed}s, ${reply.length} chars): ${JSON.stringify(replyPreview)}`,
          );
          const plain = stripMarkdown(reply);
          for (const part of chunk(plain)) {
            await space.send(part);
          }
          await convex.mutation(api.messages.send, {
            conversationId,
            role: "assistant",
            content: reply,
          });
        });
      } catch (err) {
        console.error(`[turn ${turnTag}] handler error`, err);
      }
    }
  })().catch((err) => console.error("[spectrum] message loop error", err));
}

async function spaceFor(toNumber: string) {
  if (!app) return null;
  return imessage(app).space({ phone: toNumber });
}

export async function sendImessage(toNumber: string, text: string): Promise<void> {
  const space = await spaceFor(toNumber);
  if (!space) {
    console.warn("[spectrum] sendImessage called before boot — dropping");
    return;
  }
  const plain = stripMarkdown(text);
  for (const part of chunk(plain)) {
    await space.send(part);
    console.log(`[spectrum] → sent ${part.length} chars to ${toNumber}`);
  }
}

export async function sendTypingIndicator(toNumber: string): Promise<void> {
  const space = await spaceFor(toNumber);
  if (!space) return;
  try {
    await space.startTyping();
  } catch {
    /* non-fatal */
  }
}

export function startTypingLoop(toNumber: string): () => void {
  let stopped = false;
  let active: Awaited<ReturnType<typeof spaceFor>> = null;
  (async () => {
    active = await spaceFor(toNumber);
    while (!stopped && active) {
      try { await active.startTyping(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 5000));
    }
  })();
  return () => {
    stopped = true;
    if (active) active.stopTyping().catch(() => {});
  };
}
