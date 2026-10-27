// Netlify Edge Function: writes the free "What Do I Sell?" Offer Blender through OpenRouter.
// Built from the Skill to Offer Gameplan function: same streaming, same Resend email, no buyer key (it's free).
// The prompt lives here, so the page can only ever ask for an Offer Blender.
import { getStore } from "@netlify/blobs";

const MAX_ANSWER = 1500;

const STAGES = ["Skill","Person","Offer"];
const QUESTIONS = [
  {st:0, q:"What are you good at? Your skills, your experience, the things people say you have taste in.", f:"Name the one or two things you're better at than most people around you."},
  {st:0, q:"What's one result you've got with it, for yourself or someone else? Give me the before and after.", f:"Even a small one counts. What changed, for whom, and how fast?"},
  {st:1, q:"Who do you most want to help with it? Describe one specific person, not a whole market.", f:"Be specific: their job or situation, and where they are right now."},
  {st:1, q:"What's the messy moment they're stuck in right now? Say it the way they'd say it.", f:"What's the annoying thing that happens to them this week? Something they'd actually complain about."},
  {st:1, q:"What do they hate, fear, or refuse to do to fix it?", f:"Think of what they've tried, or what they avoid: too expensive, too slow, too complicated, feels fake?"},
  {st:2, q:"Which simple version could you sell this week?", choices:["1:1 session","2-week sprint","4-week coaching package","Audit + action plan","Done-with-you setup","Template + feedback","Small group workshop","Not sure, pick for me"]}
];

function buildPrompt(answers){
  const qa = QUESTIONS.map((x,k)=>"Q"+(k+1)+" ("+STAGES[x.st]+"): "+x.q+"\nA: "+answers[k]).join("\n\n");
  return `You are the "What Do I Sell?" Offer Blender by Vlad Manea. Someone with skills, experience, taste or results but no clear offer just answered six short questions. Your job is to fill in their Offer Blender Formula: one simple first paid offer they can test with real people this week. This is a front door, not a mansion: small, clear and sellable now. You speak like Vlad: direct, warm, plain language, short sentences, a little cheeky, no hype.

Their answers:

${qa}

Write their Offer Blend in Markdown, with exactly these sections as "## " headings, in this order. Use "- " bullets, never numbered lists.

## Your Offer Blend
One sentence in exactly this shape, filled in with their details: "I help [specific person] who is struggling with [specific painful problem] get [clear result] without [thing they hate, fear or don't want to do]."
Then one line on why this is the offer to start with, using something they told you (a result, a skill, who already asks them).

## Your first paid offer
A "### [Offer Name]" subheading. The name is short and plain and says what it does (like "The Founder Brand Clean-Up" or "The Better 1:1 Sprint"), never a cute name that means nothing.
Then these bullets, each in their buyer's words:
- **Go from:** the current messy situation, written as a quote the buyer would say.
- **To:** the clear better situation, also as a quote.
- **In:** a realistic timeframe for this version.
- **By:** the simple method or support type, with 2-3 concrete parts.
- **Without:** the annoying thing they want to avoid.
- **The simplest version to sell first:** one of: 1:1 session, 2-week sprint, 4-week coaching package, audit + action plan, done-with-you setup, template + feedback, small group workshop. Respect the one they picked. If they picked "Not sure, pick for me", choose the one that best fits their skill and person, and say why in one line.

## Your offer sentence
One line: "I help [person] go from [problem] to [result] in [timeframe] without [pain]."

## Your first price to test
One price in dollars, as a bold line (for example **$297**). Then 2 sentences on why: what the result is worth to this person and what the simplest version includes. It's a test price for the first few buyers, so pitch it where a warm contact would say yes this week. Never above $1,000 for a first test.

## Your first sales message
The message to send to warm contacts, as a Markdown blockquote, filled in with their details:
"I'm testing a simple offer for [specific person] who wants [result] but is stuck with [problem]. It's called [offer name]. Want me to send you the details?"
Then one line on who to send it to first, based on who they told you they want to help.

## The beige check
Three bullets, one per rule, each showing a weak version and their version from the offer above:
- **Pick a person, not a planet.** Weak: the vague version of their person. Yours: their specific person.
- **Sell the messy moment.** Weak: a vague benefit word like "clarity" or "confidence". Yours: their messy moment.
- **Make the result visible.** Weak: a foggy result like "grow your business". Yours: their visible result.
If one of their answers was too vague to pass a rule, say so plainly and show how you sharpened it.

## Do this today
- Read your offer sentence out loud once. If it sounds like a junk drawer, cut words until it doesn't.
- Send your sales message to 10 real people who fit the person above.
- Write down every reply word for word. Those words are your next sales page.

ONE DIRECTION RULE (most important): this is about focus. Everything serves ONE person and ONE offer. Never give the reader a choice: no "or", "either", "alternatively", "and/or", no two people, no two offers, no two prices, no two messages. Wrong: "Help photographers or videographers." Right: "Help wedding photographers who want brand clients." Before you output, reread everything and rewrite any sentence that offers two options.

Rules: every line uses something they told you, no generic advice. Don't sell their life story; the buyer cares about the problem solved. Don't suggest a course as the first offer. Never promise income, client numbers or timelines for their business, and never suggest they quit a job. Never invent results, statistics or testimonials. Never promise medical, psychological or clinical outcomes. Output only the Offer Blend, starting with "## Your Offer Blend".`;
}

const json = (code, status) => new Response(JSON.stringify({ code }), {
  status, headers: { "Content-Type": "application/json" }
});

export default async (req, context) => {
  try { return await handle(req, context); }
  catch (e) { console.error("offer-blender crashed", e); return json("server_crash", 500); }
};

async function handle(req, context) {
  if (req.method !== "POST") return json("method_not_allowed", 405);
  const env = (k) => Netlify.env.get(k);

  let body;
  try { body = await req.json(); } catch { return json("bad_input", 400); }

  // Name + email entered: add them to Kit (form + tag). Capped per visitor so nobody can flood your list.
  if (body && body.action === "lead") {
    if (!env("KIT_API_KEY")) { console.error("KIT_API_KEY is not set"); return json("kit_not_configured", 500); }
    const name = cut(body.name, 60).replace(/\s+/g, " ").trim();
    const email = String(body.email || "").trim().slice(0, 120);
    if (!name || !EMAIL_RE.test(email)) return json("bad_input", 400);
    try {
      const store = getStore("offer-blender-limits");
      const k = `lead/${new Date().toISOString().slice(0, 10)}/${context.ip || "unknown"}`;
      const used = parseInt((await store.get(k)) || "0", 10);
      if (used >= 5) return json("rate_limited", 429);
      await store.set(k, String(used + 1));
    } catch (e) { console.error("lead limit store", e); }
    try { await addToKit(env, name, email); return json("ok", 200); }
    catch (e) { console.error("Kit:", e); return json("kit_failed", 502); }
  }

  // Finished run: email the lead + their Offer Blender to you via Resend.
  if (body && body.action === "done") {
    if (!env("RESEND_API_KEY") || !env("NOTIFY_EMAIL")) { console.error("Resend not configured"); return json("ok", 200); }
    try { await sendRunEmail(env, body); return json("ok", 200); }
    catch (e) { console.error("Resend:", e); return json("email_failed", 502); }
  }

  const answers = body && body.answers;
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length ||
      answers.some(a => typeof a !== "string" || !a.trim() || a.length > MAX_ANSWER)) {
    return json("bad_input", 400);
  }

  // It's free and public, so cap runs per visitor per day to protect the API bill.
  const limit = parseInt((env("OFFER_BLENDER_DAILY_LIMIT") || env("OFFER_FIX_DAILY_LIMIT")) || "2", 10);
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}/${context.ip || "unknown"}`;
  try {
    const store = getStore("offer-blender-limits");
    const used = parseInt((await store.get(key)) || "0", 10);
    if (used >= limit) return json("rate_limited", 429);
    await store.set(key, String(used + 1));
  } catch (e) { console.error("rate limit store", e); }

  // Uses OFFER_BLENDER_MODEL (or the old OFFER_FIX_MODEL) if you want a cheaper model for the free tool, otherwise the gameplan's model.
  const model = env("OFFER_BLENDER_MODEL") || env("OFFER_FIX_MODEL") || env("OPENROUTER_MODEL");
  if (!model) { console.error("OPENROUTER_MODEL is not set"); return json("missing_model", 500); }
  if (!env("OPENROUTER_API_KEY")) { console.error("OPENROUTER_API_KEY is not set"); return json("missing_api_key", 500); }
  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vlad-manea.de",
      "X-Title": "What Do I Sell Offer Blender"
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      stream: true,
      reasoning: { effort: "low", exclude: true },
      messages: [{ role: "user", content: buildPrompt(answers) }]
    })
  });
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("openrouter", upstream.status, detail);
    return json("openrouter_" + upstream.status, 502);
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" }
  });
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const escHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (t, n) => String(t || "").slice(0, n);

// Kit (ConvertKit) API v4: create or update the subscriber, add them to the form, then tag them.
const KIT_FORM_ID = "10106351";
const KIT_TAG_NAME = "Buyers";
async function kit(env, path, payload) {
  const res = await fetch("https://api.kit.com/v4" + path, {
    method: "POST",
    headers: { "X-Kit-Api-Key": env("KIT_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(path + " " + res.status + " " + (await res.text()));
  return res.json().catch(() => ({}));
}
async function addToKit(env, name, email) {
  await kit(env, "/subscribers", { email_address: email, first_name: name });
  await kit(env, "/forms/" + (env("KIT_FORM_ID") || KIT_FORM_ID) + "/subscribers", { email_address: email });
  // Creating a tag that already exists returns the existing one, so this finds "Buyers" by name.
  let tagId = env("KIT_TAG_ID");
  if (!tagId) { const t = await kit(env, "/tags", { name: KIT_TAG_NAME }); tagId = t.tag && t.tag.id; }
  if (!tagId) throw new Error("no tag id returned for " + KIT_TAG_NAME);
  await kit(env, "/tags/" + tagId + "/subscribers", { email_address: email });
}

async function sendRunEmail(env, body) {
  const name = cut(body.name, 60).replace(/\s+/g, " ").trim();
  const email = EMAIL_RE.test(String(body.email || "").trim()) ? String(body.email).trim() : "";
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, QUESTIONS.length).map(a => cut(a, MAX_ANSWER)) : [];
  const plan = cut(body.plan, 20000);
  const pairs = QUESTIONS.map((q, k) => [q.q, answers[k] || ""]);
  const html = '<div style="max-width:640px;font:14px/1.55 sans-serif">' +
    '<h2 style="font:600 16px sans-serif;margin:0 0 8px">New lead</h2><p>' + escHtml(name || "No name") + (email ? " &lt;" + escHtml(email) + "&gt;" : "") + "</p>" +
    '<h2 style="font:600 16px sans-serif;margin:24px 0 8px">Their answers</h2>' +
    pairs.map(p => "<p><strong>" + escHtml(p[0]) + "</strong><br>" + escHtml(p[1]).replace(/\n/g, "<br>") + "</p>").join("") +
    '<h2 style="font:600 16px sans-serif;margin:24px 0 8px">Their Offer Blend</h2><pre style="white-space:pre-wrap;font:13px/1.55 sans-serif">' + escHtml(plan) + "</pre></div>";
  const text = "New lead: " + (name || "No name") + (email ? " <" + email + ">" : "") + "\n\n" +
    pairs.map(p => p[0] + "\n" + p[1]).join("\n\n") + "\n\n--- Offer Blend ---\n\n" + plan;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("NOTIFY_FROM") || "Offer Blender <onboarding@resend.dev>",
      to: String(env("NOTIFY_EMAIL")).split(",").map(e => e.trim()).filter(Boolean),
      ...(email ? { reply_to: email } : {}),
      subject: "New Offer Blender lead" + (name || email ? ": " + [name, email && "<" + email + ">"].filter(Boolean).join(" ") : ""),
      html, text
    })
  });
  if (!res.ok) throw new Error(res.status + " " + (await res.text()));
}

export const config = { path: "/api/offer-blender" };
