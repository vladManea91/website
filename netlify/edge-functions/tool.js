// Runs the Offer Gameplan (netlify/worker.js) as a Netlify Edge Function.
// worker.js is the tool itself — edit only its CONFIG block. This file just connects it to Netlify.
import worker from "../worker.js";

const KEYS = ["OPENROUTER_API_KEY", "MEMBER_KEY", "RESEND_API_KEY", "NOTIFY_EMAIL", "NOTIFY_FROM"];

export default async (request) => {
  const env = {};
  for (const k of KEYS) {
    const v = Netlify.env.get(k);
    if (v) env[k] = v;
  }
  const pending = [];
  const res = await worker.fetch(request, env, { waitUntil: (p) => pending.push(p) });
  if (pending.length) await Promise.allSettled(pending); // finish sending the run email before returning
  return res;
};

export const config = { path: ["/", "/api"] };
