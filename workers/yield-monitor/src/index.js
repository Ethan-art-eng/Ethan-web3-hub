import { MONITOR_KEY, runYieldMonitor } from "../../../lib/yield-monitor.js";
import { runSiteHealthMonitor, SITE_HEALTH_KEY } from "../../../lib/site-health.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(Promise.all([runYieldMonitor(env.CEX_YIELDS), runSiteHealthMonitor(env.CEX_YIELDS)]));
  },

  async fetch(request, env) {
    if (request.method === "GET") {
      if (new URL(request.url).searchParams.get("scope") === "site") {
        const siteReport = await env.CEX_YIELDS.get(SITE_HEALTH_KEY, "json");
        return json(siteReport || { checkedAt: null, checks: [] });
      }
      const report = await env.CEX_YIELDS.get(MONITOR_KEY, "json");
      return json(report || { checkedAt: null, exchanges: [] });
    }

    if (request.method === "POST") {
      const authorization = request.headers.get("authorization");
      if (!env.MONITOR_TOKEN || authorization !== `Bearer ${env.MONITOR_TOKEN}`) return json({ error: "Unauthorized" }, 401);
      try {
        const [yieldReport, siteReport] = await Promise.all([runYieldMonitor(env.CEX_YIELDS), runSiteHealthMonitor(env.CEX_YIELDS)]);
        return json({ ok: true, data: yieldReport, site: siteReport });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
