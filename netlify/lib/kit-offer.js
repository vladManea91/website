// Saves the offer someone generated onto their Kit subscriber, as custom fields,
// so Kit emails can say "your offer {{ subscriber.offer_name }} at {{ subscriber.offer_price }}".
// Used by the Offer Blender (free) and the First Client Roadmap ($9). Never throws.

export const OFFER_FIELDS = [
  { key: "offer_name", label: "Offer name" },
  { key: "offer_sentence", label: "Offer sentence" },
  { key: "offer_who", label: "Offer who" },
  { key: "offer_price", label: "Offer price" },
  { key: "offer_founding_price", label: "Offer founding price" },
  { key: "offer_source", label: "Offer source" },
  { key: "offer_date", label: "Offer date" }
];

const clean = (s, n) => String(s || "").replace(/\*\*/g, "").replace(/[“”"]/g, "").replace(/\s+/g, " ").trim().slice(0, n || 250);
const money = (s) => { const m = String(s || "").match(/([$€£])\s?(\d[\d,.]*)/); return m ? m[1] + m[2].replace(/[.,]$/, "") : ""; };

// Pulls the offer out of the Markdown the AI wrote. source: "Offer Blender" | "First Client Roadmap".
export function parseOffer(text, source) {
  const t = String(text || "");
  const line = (re) => { const m = t.match(re); return m ? m[1] : ""; };
  // Name: "**Offer name:** X" (Roadmap), otherwise the first "### " heading that isn't a fixed Roadmap subheading.
  let name = line(/\*\*Offer name:\*\*\s*([^\n]+)/i);
  if (!name) {
    const heads = [...t.matchAll(/^###\s+(.+)$/gm)].map(m => m[1].trim())
      .filter(h => !/^(your |how it works|what changed|when someone)/i.test(h));
    name = heads[0] || "";
  }
  const sentence = line(/^\s*(?:>\s*)?(?:\*\*)?(I help [^\n]+)/m);
  let who = "";
  const w = sentence.match(/^I help (.+?)(?: who | get | go from | to | through |,)/i);
  if (w) who = w[1];
  const founding = money(line(/Founding price:\*?\*?([^\n]+)/i));
  const price = money(line(/Full price:\*?\*?([^\n]+)/i)) || money(line(/\*\*Price:\*\*([^\n]+)/i)) || founding;
  return {
    offer_name: clean(name, 120),
    offer_sentence: clean(sentence, 400),
    offer_who: clean(who, 160),
    offer_price: price,
    offer_founding_price: founding,
    offer_source: source,
    offer_date: new Date().toISOString().slice(0, 10)
  };
}

async function call(env, method, url, headers, payload) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: payload ? JSON.stringify(payload) : undefined });
  const text = await res.text();
  let data = {}; try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) { const e = new Error(res.status + " " + text.slice(0, 200)); e.status = res.status; throw e; }
  return data;
}

// Writes the fields onto the subscriber (creating the fields in Kit the first time).
export async function saveOfferToKit(env, email, name, fields) {
  if (!env("KIT_API_KEY")) return { ok: false, detail: "KIT_API_KEY is not set" };
  if (!email) return { ok: false, detail: "no email" };
  const values = Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
  if (!values.offer_name && !values.offer_sentence) return { ok: false, detail: "couldn't read an offer from the text" };
  const key = env("KIT_API_KEY");
  try {
    const v4 = (m, p, b) => call(env, m, "https://api.kit.com/v4" + p, { "X-Kit-Api-Key": key }, b);
    const existing = await v4("GET", "/custom_fields?per_page=1000").catch(() => ({ custom_fields: [] }));
    const have = new Set((existing.custom_fields || []).map(f => f.key));
    for (const f of OFFER_FIELDS) if (!have.has(f.key)) await v4("POST", "/custom_fields", { label: f.label }).catch(e => console.error("Kit field", f.key, e.message));
    await v4("POST", "/subscribers", { email_address: email, ...(name ? { first_name: name } : {}), fields: values });
    return { ok: true, detail: "saved offer fields (" + Object.keys(values).join(", ") + ")" };
  } catch (e) {
    if (e.status !== 401 && e.status !== 403) return { ok: false, detail: "Kit v4: " + e.message };
  }
  // Classic v3 key: create missing fields (needs KIT_API_SECRET), then update through the form.
  try {
    const base = "https://api.convertkit.com/v3";
    if (env("KIT_API_SECRET")) {
      const list = await call(env, "GET", base + "/custom_fields?api_key=" + encodeURIComponent(key), {}).catch(() => ({ custom_fields: [] }));
      const have = new Set((list.custom_fields || []).map(f => f.key));
      const missing = OFFER_FIELDS.filter(f => !have.has(f.key)).map(f => f.label);
      if (missing.length) await call(env, "POST", base + "/custom_fields", {}, { api_secret: env("KIT_API_SECRET"), label: missing }).catch(e => console.error("Kit v3 fields", e.message));
    }
    const formId = env("KIT_FORM_ID") || "10106351";
    await call(env, "POST", base + "/forms/" + formId + "/subscribe", {}, { api_key: key, email, ...(name ? { first_name: name } : {}), fields: values });
    return { ok: true, detail: "saved offer fields (classic v3 key)" };
  } catch (e) {
    return { ok: false, detail: "Kit v3: " + e.message };
  }
}
