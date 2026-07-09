// netlify/functions/stats.js
//
// Aggregates the pageview events stored by track.js into summary
// numbers for the dashboard. Protected by a shared token so the
// data isn't public: set ANALYTICS_TOKEN in Netlify's environment
// variables, then the dashboard page asks for that same token.

import { getStore } from "@netlify/blobs";

function topN(counts, n = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-analytics-token");
  const expected = Netlify.env.get("ANALYTICS_TOKEN");

  if (!expected) {
    return new Response(
      JSON.stringify({ error: "ANALYTICS_TOKEN is not set in Netlify environment variables yet." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
  if (token !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 90);
  const store = getStore("analytics");

  const dateKeys = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dateKeys.push(`events/${d.toISOString().slice(0, 10)}.json`);
  }

  let allEvents = [];
  for (const key of dateKeys) {
    try {
      const dayEvents = await store.get(key, { type: "json" });
      if (Array.isArray(dayEvents)) allEvents = allEvents.concat(dayEvents);
    } catch {
      // no data for that day, skip
    }
  }

  const byDay = {};
  const byPath = {};
  const byReferrer = {};
  const bySource = {};
  const byCampaign = {};
  const byDevice = {};
  const byBrowser = {};
  const byCountry = {};

  for (const e of allEvents) {
    const day = (e.t || "").slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
    byPath[e.path || "(unknown)"] = (byPath[e.path || "(unknown)"] || 0) + 1;

    let ref = "Direct / no referrer";
    if (e.referrer) {
      try {
        ref = new URL(e.referrer).hostname.replace(/^www\./, "");
      } catch {
        ref = e.referrer;
      }
    }
    byReferrer[ref] = (byReferrer[ref] || 0) + 1;

    const src = e.utm_source || e.first_source || (e.referrer ? ref : "direct");
    bySource[src] = (bySource[src] || 0) + 1;

    if (e.utm_campaign) byCampaign[e.utm_campaign] = (byCampaign[e.utm_campaign] || 0) + 1;

    byDevice[e.device || "unknown"] = (byDevice[e.device || "unknown"] || 0) + 1;
    byBrowser[e.browser || "unknown"] = (byBrowser[e.browser || "unknown"] || 0) + 1;
    byCountry[e.country || "unknown"] = (byCountry[e.country || "unknown"] || 0) + 1;
  }

  const dailySeries = Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, count]) => ({ date, count }));

  const result = {
    total_views: allEvents.length,
    range_days: days,
    daily: dailySeries,
    top_pages: topN(byPath, 10),
    top_referrers: topN(byReferrer, 10),
    top_sources: topN(bySource, 10),
    top_campaigns: topN(byCampaign, 10),
    devices: topN(byDevice, 5),
    browsers: topN(byBrowser, 6),
    countries: topN(byCountry, 10),
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
