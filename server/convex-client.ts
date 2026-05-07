import { ConvexHttpClient } from "convex/browser";

// `npx convex dev` writes VITE_CONVEX_URL (for the frontend) but not always
// CONVEX_URL — they're the same deployment URL, just different consumers.
// Fall back so a fresh `convex dev` setup boots the server without hand-edits.
const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
if (!url) {
  throw new Error(
    "CONVEX_URL is not set. Run `npm run setup` or `npx convex dev` to configure Convex.",
  );
}

export const convex = new ConvexHttpClient(url);
