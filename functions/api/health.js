import { getDataStatus, SITE_HEALTH_KEY } from "../../lib/site-health.js";

const DATASETS = [
  { id: "airdrops", label: "空投项目", key: "airdrop-projects", field: "projects", seed: "/data/airdrop-projects.json" },
  { id: "site-content", label: "工具与教程", key: "site-content", field: "toolGroups", seed: "/data/site-content.json" },
  { id: "wealth", label: "币圈理财", key: "cex-yields", field: "campaigns", seed: "/data/cex-yields.json" },
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function onRequestGet(context) {
  if (!context.env.CEX_YIELDS) return json({ status: "unknown", error: "Health storage is unavailable" }, 503);
  try {
    const loadDataset = async (item) => {
      const stored = await context.env.CEX_YIELDS.get(item.key, "json");
      if (stored) return stored;
      const response = await context.env.ASSETS.fetch(new URL(item.seed, context.request.url));
      return response.ok ? response.json() : null;
    };
    const [report, ...payloads] = await Promise.all([
      context.env.CEX_YIELDS.get(SITE_HEALTH_KEY, "json"),
      ...DATASETS.map(loadDataset),
    ]);
    const datasets = DATASETS.map((item, index) => {
      const payload = payloads[index];
      const freshness = getDataStatus(payload?.updatedAt);
      return {
        id: item.id,
        label: item.label,
        available: Boolean(payload),
        count: Array.isArray(payload?.[item.field]) ? payload[item.field].length : null,
        ...freshness,
      };
    });
    const issueCount = report?.issueCount || 0;
    const staleCount = datasets.filter((item) => item.stale).length;
    return json({
      status: issueCount ? "degraded" : staleCount ? "stale" : "healthy",
      checkedAt: report?.checkedAt || null,
      issueCount,
      staleCount,
      datasets,
    });
  } catch (error) {
    return json({ status: "unknown", error: error.message }, 500);
  }
}
