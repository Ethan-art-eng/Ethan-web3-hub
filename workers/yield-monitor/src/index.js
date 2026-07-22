import { MONITOR_KEY, runYieldMonitor } from "../../../lib/yield-monitor.js";
import { runSiteHealthMonitor, SITE_HEALTH_KEY } from "../../../lib/site-health.js";
import { BARKER_SYNC_STATUS_KEY, syncBarkerCampaigns } from "../../../lib/barker-yield-sync.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async scheduled(controller, env, ctx) {
    const task = controller.cron === "0 */6 * * *"
      ? Promise.all([syncBarkerCampaigns(env.CEX_YIELDS), runYieldMonitor(env.CEX_YIELDS), runSiteHealthMonitor(env.CEX_YIELDS)])
      : syncBarkerCampaigns(env.CEX_YIELDS);
    ctx.waitUntil(task);
  },

  async fetch(request, env) {
    if (request.method === "GET") {
      if (new URL(request.url).searchParams.get("scope") === "barker") {
        const syncReport = await env.CEX_YIELDS.get(BARKER_SYNC_STATUS_KEY, "json");
        return json(syncReport || { status: "pending", attemptedAt: null });
      }
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
        const [barkerData, yieldReport, siteReport] = await Promise.all([syncBarkerCampaigns(env.CEX_YIELDS), runYieldMonitor(env.CEX_YIELDS), runSiteHealthMonitor(env.CEX_YIELDS)]);
        return json({ ok: true, barker: { updatedAt: barkerData.updatedAt, campaigns: barkerData.campaigns.length }, data: yieldReport, site: siteReport });
      } catch (error) {
        return json({ error: error.message }, 500);
      }
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
