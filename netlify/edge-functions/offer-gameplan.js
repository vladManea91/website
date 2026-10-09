// Offer Gameplan — runs ONLY on gameplan.vlad-manea.de. On every other host
// (vlad-manea.de, www, deploy previews) it steps aside and your site loads as normal.
// The tool itself lives in netlify/offer-gameplan/worker.js — edit only its CONFIG block.
import worker from "../offer-gameplan/worker.js";

const HOST = "gameplan.vlad-manea.de";
const KEYS = ["OPENROUTER_API_KEY", "MEMBER_KEY", "RESEND_API_KEY", "NOTIFY_EMAIL", "NOTIFY_FROM"];

export default async (request) => {
  if (new URL(request.url).hostname !== HOST) return; // not the tool's subdomain: serve the normal site

  const env = {};
  for (const k of KEYS) {
    const v = Netlify.env.get(k);
    if (v) env[k] = v;
  }
  const pending = [];
  const res = await worker.fetch(request, env, { waitUntil: (p) => pending.push(p) });
  if (pending.length) await Promise.allSettled(pending); // finish sending the run email
  return res;
};

export const config = { path: ["/", "/api"] };
