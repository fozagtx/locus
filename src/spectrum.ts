import { Spectrum } from "spectrum-ts";
import { terminal } from "spectrum-ts/providers/terminal";
import { imessage } from "spectrum-ts/providers/imessage";
import { runAgent } from "./agent.js";

export async function startSpectrum() {
  const projectId = process.env.SPECTRUM_PROJECT_ID;
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET;

  if (process.env.SPECTRUM_ENABLED !== "1") {
    console.log("[spectrum] disabled (set SPECTRUM_ENABLED=1 to boot, or run `npm run dev:agent`)");
    return null;
  }

  if (!projectId || !projectSecret) {
    console.warn("[spectrum] credentials missing — skipping agent boot");
    return null;
  }

  const withTerminal = process.env.SPECTRUM_TERMINAL === "1";
  const app = withTerminal
    ? await Spectrum({
        projectId,
        projectSecret,
        providers: [imessage.config(), terminal.config()],
      })
    : await Spectrum({
        projectId,
        projectSecret,
        providers: [imessage.config()],
      });

  console.log(`[spectrum] booted with providers: ${withTerminal ? "imessage + terminal" : "imessage"}`);

  (async () => {
    for await (const [space, message] of app.messages) {
      console.log(`[spectrum] inbound from ${message.platform}: ${message.content.type}`);
      if (message.content.type !== "text") continue;
      const prompt = message.content.text;

      try {
        await space.responding(async () => {
          const reply = await runAgent(prompt);
          if (reply) await space.send(reply);
        });
      } catch (err) {
        console.error("[spectrum] reply failed", err);
      }
    }
  })().catch((err) => console.error("[spectrum] message loop error", err));

  return app;
}
