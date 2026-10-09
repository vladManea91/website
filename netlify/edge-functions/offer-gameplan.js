// Offer Gameplan — runs ONLY on gameplan.vlad-manea.de. On every other host
// (vlad-manea.de, www, deploy previews) it steps aside and your site loads as normal.
// The tool itself lives in netlify/offer-gameplan/worker.js — edit only its CONFIG block.
import worker from "../offer-gameplan/worker.js";

const HOST = "gameplan.vlad-manea.de";
const KEYS = ["OPENROUTER_API_KEY", "MEMBER_KEY", "RESEND_API_KEY", "NOTIFY_EMAIL", "NOTIFY_FROM"];

function readEnv() {
  const env = {};
  for (const k of KEYS) {
    const v = Netlify.env.get(k);
    if (v) env[k] = v;
  }
  return env;
}

async function run(request) {
  const pending = [];
  const res = await worker.fetch(request, readEnv(), { waitUntil: (p) => pending.push(p) });
  if (pending.length) await Promise.allSettled(pending); // finish sending the run email
  return res;
}

export default async (request) => {
  if (new URL(request.url).hostname !== HOST) return; // not the tool's subdomain: serve the normal site

  // AI steps can take longer than Netlify's 40-second limit for a response to START.
  // So for those we start the response immediately, send a space every 10 seconds to keep
  // the connection alive, and write the real answer when it's ready.
  let action = "";
  if (request.method === "POST") {
    try { action = (await request.clone().json()).action; } catch { /* worker handles bad JSON */ }
  }
  if (action !== "ai") return run(request);

  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const out = writable.getWriter();
  const ping = setInterval(() => out.write(enc.encode(" ")).catch(() => {}), 10000);

  (async () => {
    let body;
    try {
      body = await (await run(request)).text();
    } catch (e) {
      console.error("offer-gameplan:", e);
      body = JSON.stringify({ ok: false, error: "That step didn't finish. Try again." });
    }
    clearInterval(ping);
    try { await out.write(enc.encode(body)); await out.close(); } catch { /* visitor left */ }
  })();

  return new Response(readable, {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
};

export const config = { path: ["/", "/api"] };
