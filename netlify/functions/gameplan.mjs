// Netlify Function: writes the Offer Gameplan with the Anthropic API.
// The prompt lives here on the server, so the page can only ever ask for a gameplan.
import { getStore } from "@netlify/blobs";

const LAUNCHOS_LINK = "https://docs.google.com/document/d/1-kZPOzLjudgzTBtkxuwDTKlfb5WaMPEQ3SxFKq11EAI/edit?tab=t.0";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || "3", 10);
const MAX_ANSWER = 2000;

const QUESTIONS = [
  "What do you do for work right now, and what are you good at outside of it?",
  "What do people already ask you for help with? Friends, colleagues, people online.",
  "Which business directions have you been bouncing between? List them all, even the half-serious ones.",
  "What have you already tried, even briefly? What happened?",
  "Who could you reach without ads? Roughly how many people, and where?",
  "Honestly, how many hours a week can you give this alongside everything else?",
  "What would make the next 90 days feel like a win?",
  "What's actually stopped you so far?"
];

function buildPrompt(answers){
  const qa = QUESTIONS.map((q,k)=>"Q"+(k+1)+": "+q+"\nA: "+answers[k]).join("\n\n");
  return `You are the Offer Gameplan by Vlad Manea, for creative people (working a job, freelancing, or between things) who know they could build something of their own but have too many directions to pick one. You speak like Vlad: direct, warm not soft, plain language, short sentences, no hype. The person has skills already; this is about pointing them somewhere.

They answered these questions:

${qa}

Write their plan in Markdown, with exactly these four sections as "## " headings:

## Your pattern
3-5 sentences reflecting the pattern under their answers. A mirror, not a diagnosis. Plain paragraphs, no bullets. Use at least two specific details they gave. If a sentence could apply to anyone, rewrite it.

## Your one direction
Score each direction they named 0-2 on: Asked (do people already ask them for this?), Paid (do people already pay someone for this result?), Reach (could they name 10 people who fit?), Stamina (will they still care in 2 years?). Show this as a short bulleted list, one bullet per direction, with the four scores and total. Name the winner and say in one line why the others are parked, not dead. If every direction scores low, say so honestly instead of forcing a winner.
Then a "### Your one-sentence offer" subheading with: "I help [specific person] get [specific result] through [what they deliver]."
Then a "### First offer outline" subheading with bullets: who it's for, the problem, the outcome, the format, and a simple test price.

## Your first 30 days
Three ranked moves as "### 1. ...", "### 2. ...", "### 3. ..." subheadings, built for the hours they said they have. For each: what it is, why it matters for them, one concrete first step this week. Move 1 is always getting the offer in front of real people (if every direction scored low, Move 1 is a 7-day test). Under Move 1, include a first message they can send to 10 people, in their own voice, as a Markdown blockquote.

## The gap
4-6 honest sentences on what this plan can't do alone: shaping the offer as feedback comes in, talking about it so the right people notice, and what to do with the first yes or the first silence. Not a pitch. End with exactly:
"If this resonated, if you read your pattern and felt seen, that's not a coincidence. This is what I do inside LaunchOS. If you want to go further than a plan: [LaunchOS](${LAUNCHOS_LINK})"

Rules: every line must reference something they told you, no generic advice. Never promise income or timelines, and never suggest they can or should quit a job. Never invent client results or statistics. Never promise medical, psychological or clinical outcomes. Output only the plan, starting with "## Your pattern".`;
}

const json = (code, status) => new Response(JSON.stringify({ code }), {
  status, headers: { "Content-Type": "application/json" }
});

export default async (req, context) => {
  if (req.method !== "POST") return json("method_not_allowed", 405);

  // Optional buyer gate: set ACCESS_KEY in Netlify and add ?access=<key> to the ThriveCart success URL.
  const accessKey = process.env.ACCESS_KEY;
  if (accessKey && req.headers.get("x-access-key") !== accessKey) return json("no_access", 403);

  let answers;
  try {
    ({ answers } = await req.json());
  } catch { return json("bad_input", 400); }
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length ||
      answers.some(a => typeof a !== "string" || !a.trim() || a.length > MAX_ANSWER)) {
    return json("bad_input", 400);
  }

  // Simple per-visitor daily limit, so a leaked link can't run up your API bill.
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `${day}/${ip}`;
  try {
    const store = getStore("gameplan-limits");
    const used = parseInt((await store.get(rlKey)) || "0", 10);
    if (used >= DAILY_LIMIT) return json("rate_limited", 429);
    await store.set(rlKey, String(used + 1));
  } catch (e) { console.error("rate limit store", e); }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      stream: true,
      messages: [{ role: "user", content: buildPrompt(answers) }]
    })
  });
  if (!upstream.ok || !upstream.body) {
    console.error("anthropic", upstream.status, await upstream.text().catch(() => ""));
    return json("error", 502);
  }

  // Turn Anthropic's event stream into plain text for the page.
  const enc = new TextEncoder(), dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
              controller.enqueue(enc.encode(ev.delta.text));
            } else if (ev.type === "error") {
              console.error("anthropic stream", ev.error);
              controller.enqueue(enc.encode("\u0000ERROR"));
            }
          }
        }
      } catch (e) {
        console.error("stream", e);
        controller.enqueue(enc.encode("\u0000ERROR"));
      }
      controller.close();
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
};

export const config = { path: "/api/gameplan" };
