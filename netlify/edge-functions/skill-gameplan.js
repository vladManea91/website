// Netlify Edge Function: writes the Skill to Offer Gameplan through OpenRouter.
// Edge functions can stream for as long as the model writes, so long plans don't time out.
// The prompt lives here, so the page can only ever ask for a gameplan.
import { getStore } from "@netlify/blobs";

const LAUNCHOS_LINK = "https://docs.google.com/document/d/1-kZPOzLjudgzTBtkxuwDTKlfb5WaMPEQ3SxFKq11EAI/edit?tab=t.0";
const MAX_ANSWER = 2500;

const STAGES = ["Background","Skills","Market","Offer","Price","Content"];
const QUESTIONS = [
  {st:0, q:"Let's begin. Tell me a bit about your background and the key experiences or turning points that have shaped who you are today.", f:"Give me one turning point. What happened, and what changed for you after it?"},
  {st:0, q:"What's the biggest challenge you've overcome, in your life or your career?", f:"What was hard about it, and what did you do that actually worked?"},
  {st:1, q:"What do you do for work, and what are you good at outside of it? Skills, side projects, things you taught yourself.", f:"Name two or three things you're genuinely better at than most people around you."},
  {st:1, q:"What results have you got, for yourself or for someone else? Give me a before and after.", f:"Even a small one counts. What changed, for whom, and how long did it take?"},
  {st:1, q:"What do people already ask you for advice on?", f:"Think of the last few months. What's one thing someone asked you about?"},
  {st:2, q:"Who would benefit most from what you know? Describe the person or industry, and what they're struggling with right now.", f:"Be specific: their job or situation, and the exact problem that keeps them stuck."},
  {st:4, q:"What does it cost that person to not solve this problem? Money, time, missed chances, stress. And what's it worth to them once it's solved?", f:"Put a number on it if you can, even a rough one: lost income, hours wasted, a price they already pay for something worse."},
  {st:3, q:"Which way of delivering it fits you best?", choices:["1:1 coaching","Done-with-you (we build it together)","Done-for-you service","Small group or community","Digital product or course","Not sure yet"]},
  {st:5, q:"Where do you post, or where would you post?", choices:["Instagram","LinkedIn","TikTok","YouTube","Not posting yet"]},
  {st:5, q:"How many hours a week can you give this?", choices:["1–2 hours","3–5 hours","6–10 hours","More than 10"]}
];

function buildPrompt(answers){
  const qa = QUESTIONS.map((x,k)=>"Stage "+(x.st+1)+" ("+STAGES[x.st]+") · Q"+(k+1)+": "+x.q+"\nA: "+answers[k]).join("\n\n");
  return `You are the Skill to Offer Gameplan by Vlad Manea: an expert offer architect who has just interviewed someone in six stages (background discovery, skill extraction, market alignment, offer architecture, price validation, and content). The person is a creator, coach, consultant or other skilled person (working a job, freelancing, or between things). Your job is to uncover, structure and price the most valuable offer they can create from their own experience, skills and story, then plan the content that attracts its buyers. You speak like Vlad: direct, warm not soft, plain language, short sentences, no hype.

Their interview:

${qa}

Write their gameplan in Markdown, with exactly these eight sections as "## " headings. Use "- " bullets for lists, never numbered lists.

## Your story and skills
3-5 sentences. Name the turning points and the challenge they overcame, and what those give them that most people in their field don't have. Name every monetizable skill and transformation you heard, including ones they undersold. Then name the ONE skill or transformation with the strongest signal (people already ask for it, they have a result with it, and someone already pays for that result) and say why in one line, using their own details.

## Your market
- Who it's for: one specific person (job or situation, stage, not "beginners" or "people").
- What they're struggling with, in words that person would use.
- Why they'd pay: what they already spend money or time on trying to fix it.
- Why you: the line from their story or results that makes them credible to this person.

## Your offer
A "### Your one-sentence offer" subheading with: "I help [specific person] get [specific, measurable result] through [named format and length]."
Then a "### How it works" subheading with bullets: the promised result, the format (respect the format they chose; if "Not sure yet", pick the one that best fits their skill, hours and person, and say why in one line), how long it lasts, what's included (3-5 concrete things), and who it's not for.
Give the offer a short, plain name.

## Your price
Validate the price from the interview, never from wishful thinking.
- The measurable transformation: what changes for the buyer, in numbers where they gave any.
- The cost of inaction: what staying stuck costs this person, using what they told you.
- The ROI: a simple line comparing the price to the value of the result, using only numbers they gave or clearly labelled rough estimates.
- Full price: the price this transformation supports. Go to $3,000-10,000 only when the transformation, the cost of inaction and their proof clearly justify it. If they don't yet, say so plainly, give the price the offer supports today, and name the proof that would unlock the higher price (for example "three client results like X").
- Founding price: a lower price for the first 3-5 clients in exchange for feedback and a testimonial, so they can sell it this month.

## Your positioning
- Your hook: one line that stops their person scrolling.
- Your story angle: the moment from their background to tell again and again, and why it builds trust with this person.
- Your core message: one emotional line (how it feels to stay stuck vs after) and one logical line (why this approach works), both in their voice.

## Your content plan
Built for the platform they chose (if "Not posting yet", pick the one that best fits the person their offer is for and say why in one line). Every post serves this one offer and attracts the person it's for.
A "### Your three content pillars" subheading with three bullets, each with a name and one line on what it covers:
- The problem: posts that name the exact struggle, so their person thinks "that's me".
- The proof: posts that show their story, results, process or a before and after, so people trust them.
- The path: posts that share their point of view and invite people into a conversation about the offer.
Then a "### Your first 2 weeks of posts" subheading. Size the number of posts to their hours (1-2 h: 4 posts, 3-5 h: 6 posts, 6+ h: 8 posts). One bullet per post in this exact shape: "**Day X · Pillar · Format** (format fits the platform, e.g. carousel, reel, text post, short): Hook: \\"the opening line, in their voice\\". Then one sentence on what the post shows." At least one post tells the story angle. Hooks must be specific to their story and person, never generic.
Then a "### Your call to action" subheading: ONE call to action used on every proof and path post, built for the platform (e.g. comment a keyword to get a DM). Give the exact line.

## From comment to client
A "### When someone comments or DMs" subheading with a 3-message DM sequence as Markdown blockquotes, each with a one-line label before it: (1) the first reply that asks about their situation, (2) the questions that find out if the offer fits and what the problem costs them, (3) the invitation to a short call or straight to the offer at the founding price. Written in their voice, for this one offer.
Then one line: what a good week looks like (how many conversations to aim for with the hours they have, framed as a target, not a promise).

## The gap
3-5 honest sentences on what this plan can't do alone: knowing which posts are working, adjusting the offer when the first conversations reveal what people really want, holding a high price on a sales call, and keeping going when a post flops. Not a pitch. End with exactly:
"If you want help building and selling this offer, this is what I do inside LaunchOS: [LaunchOS](${LAUNCHOS_LINK})"

ONE OFFER RULE (most important): this gameplan is about focus. From "## Your market" to the end, everything serves the ONE offer and the ONE person it's for. Never give the reader a choice between options: no "or", "either", "alternatively", "and/or", no two audiences, no two offers, no two prices besides the full and founding price, no two calls to action. Wrong: "Post about photo editing or about starting a brand." Right: "Post about how hobby photographers can edit photos that look like their own style." Before you output, reread everything after "## Your story and skills" and rewrite any sentence that gives two options.

Rules: every line must reference something they told you, no generic advice. Never promise income, follower counts or timelines, and never suggest they can or should quit a job. Never invent client results, statistics or testimonials; proof posts and ROI lines use only results and numbers they told you, and any estimate is labelled as one. Never promise medical, psychological or clinical outcomes. Output only the gameplan, starting with "## Your story and skills".`;
}

const json = (code, status) => new Response(JSON.stringify({ code }), {
  status, headers: { "Content-Type": "application/json" }
});

export default async (req, context) => {
  try { return await handle(req, context); }
  catch (e) { console.error("skill-gameplan crashed", e); return json("server_crash", 500); }
};

async function handle(req, context) {
  if (req.method !== "POST") return json("method_not_allowed", 405);
  const env = (k) => Netlify.env.get(k);

  // Buyer gate: set ACCESS_KEY in Netlify and add ?access=<key> to the ThriveCart success URL.
  const accessKey = env("ACCESS_KEY");
  if (accessKey && req.headers.get("x-access-key") !== accessKey) return json("no_access", 403);

  let body;
  try { body = await req.json(); } catch { return json("bad_input", 400); }

  // Finished run: email it to you via Resend (uses the same RESEND_API_KEY / NOTIFY_EMAIL / NOTIFY_FROM as the old tool).
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

  // Per-visitor daily limit, so a forwarded link can't run up your API bill.
  const limit = parseInt(env("DAILY_LIMIT") || "3", 10);
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}/${context.ip || "unknown"}`;
  try {
    const store = getStore("skill-gameplan-limits");
    const used = parseInt((await store.get(key)) || "0", 10);
    if (used >= limit) return json("rate_limited", 429);
    await store.set(key, String(used + 1));
  } catch (e) { console.error("rate limit store", e); }

  const model = env("OPENROUTER_MODEL");
  if (!model) { console.error("OPENROUTER_MODEL is not set"); return json("missing_model", 500); }
  if (!env("OPENROUTER_API_KEY")) { console.error("OPENROUTER_API_KEY is not set"); return json("missing_api_key", 500); }
  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vlad-manea.de",
      "X-Title": "Skill to Offer Gameplan"
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      stream: true,
      reasoning: { effort: "low", exclude: true }, // keeps thinking short on reasoning models; ignored by others
      messages: [{ role: "user", content: buildPrompt(answers) }]
    })
  });
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("openrouter", upstream.status, detail);
    return json("openrouter_" + upstream.status, 502);
  }
  // Pass OpenRouter's event stream straight through; the page reads it.
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" }
  });
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const escHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (t, n) => String(t || "").slice(0, n);

async function sendRunEmail(env, body) {
  const name = cut(body.name, 60).replace(/\s+/g, " ").trim();
  const email = EMAIL_RE.test(String(body.email || "").trim()) ? String(body.email).trim() : "";
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, QUESTIONS.length).map(a => cut(a, MAX_ANSWER)) : [];
  const plan = cut(body.plan, 40000);
  const pairs = QUESTIONS.map((q, k) => [q.q, answers[k] || ""]);
  const html = '<div style="max-width:640px;font:14px/1.55 sans-serif">' +
    '<h2 style="font:600 16px sans-serif;margin:0 0 8px">Who</h2><p>' + escHtml(name || "No name") + (email ? " &lt;" + escHtml(email) + "&gt;" : "") + "</p>" +
    '<h2 style="font:600 16px sans-serif;margin:24px 0 8px">Their answers</h2>' +
    pairs.map(p => "<p><strong>" + escHtml(p[0]) + "</strong><br>" + escHtml(p[1]).replace(/\n/g, "<br>") + "</p>").join("") +
    '<h2 style="font:600 16px sans-serif;margin:24px 0 8px">Their gameplan</h2><pre style="white-space:pre-wrap;font:13px/1.55 sans-serif">' + escHtml(plan) + "</pre></div>";
  const text = "Who: " + (name || "No name") + (email ? " <" + email + ">" : "") + "\n\n" +
    pairs.map(p => p[0] + "\n" + p[1]).join("\n\n") + "\n\n--- Gameplan ---\n\n" + plan;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("NOTIFY_FROM") || "Skill to Offer Gameplan <onboarding@resend.dev>",
      to: String(env("NOTIFY_EMAIL")).split(",").map(e => e.trim()).filter(Boolean),
      ...(email ? { reply_to: email } : {}),
      subject: "New Skill to Offer Gameplan" + (name || email ? ": " + [name, email && "<" + email + ">"].filter(Boolean).join(" ") : ""),
      html, text
    })
  });
  if (!res.ok) throw new Error(res.status + " " + (await res.text()));
}

export const config = { path: "/api/skill-gameplan" };
