// netlify/functions/track.js
//
// Receives a small pageview beacon from every page on the site and
// stores it in Netlify Blobs, Netlify's built-in key-value store.
// No external service, no third-party analytics vendor.

import { getStore } from "@netlify/blobs";

function parseDevice(ua = "") {
  const isMobile = /Mobile|Android|iPhone/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua);
  let device = "desktop";
  if (isTablet) device = "tablet";
  else if (isMobile) device = "mobile";

  let browser = "other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  return { device, browser };
}

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const {
    path = "/",
    referrer = "",
    utm_source = "",
    utm_medium = "",
    utm_campaign = "",
    utm_content = "",
    first_source = "",
    type = "pageview",
    cta_destination = "",
  } = body;

  const ua = req.headers.get("user-agent") || "";
  const { device, browser } = parseDevice(ua);

  // Netlify provides geolocation on the function's `context` argument,
  // derived from the visitor's IP by Netlify's own network (no raw IP
  // is ever stored by us, only the resolved country).
  const geo = (context && context.geo) || {};
  const countryCode = geo.country?.code || "unknown";
  const countryName = geo.country?.name || countryCode;

  const now = new Date();
  const event = {
    t: now.toISOString(),
    type: String(type).slice(0, 20) === "cta_click" ? "cta_click" : "pageview",
    path: String(path).slice(0, 300),
    referrer: String(referrer).slice(0, 300),
    utm_source: String(utm_source).slice(0, 100),
    utm_medium: String(utm_medium).slice(0, 100),
    utm_campaign: String(utm_campaign).slice(0, 100),
    utm_content: String(utm_content).slice(0, 100),
    first_source: String(first_source).slice(0, 100),
    cta_destination: String(cta_destination).slice(0, 300),
    device,
    browser,
    country_code: countryCode,
    country: countryName,
  };

  const store = getStore("analytics");
  const dayKey = `events/${now.toISOString().slice(0, 10)}.json`;

  let dayEvents = [];
  try {
    const existing = await store.get(dayKey, { type: "json" });
    if (Array.isArray(existing)) dayEvents = existing;
  } catch {
    // no events yet for today
  }

  dayEvents.push(event);
  // Keep each day's file bounded so it never grows unbounded on a
  // single very high traffic day.
  if (dayEvents.length > 20000) dayEvents = dayEvents.slice(-20000);

  await store.setJSON(dayKey, dayEvents);

  return new Response(null, { status: 204 });
};
