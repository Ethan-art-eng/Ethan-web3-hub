export const SITE_HEALTH_KEY = "site-health-monitor";
export const DATA_STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export const SITE_CHECKS = [
  { id: "home", label: "首页", path: "/", type: "html", expected: "捕捉前沿信息" },
  { id: "airdrops", label: "空投项目", path: "/airdrops/", type: "html", expected: "airdropInitialData" },
  { id: "courses", label: "教程", path: "/courses/", type: "html", expected: "Web3 教程路线" },
  { id: "toolbox", label: "工具箱", path: "/toolbox/", type: "html", expected: "实战工具目录" },
  { id: "wealth", label: "币圈理财", path: "/wealth/", type: "html", expected: "campaignInitialData" },
  { id: "airdrop-api", label: "空投数据", path: "/api/airdrop-projects", type: "json", dataKey: "projects" },
  { id: "content-api", label: "工具与教程数据", path: "/api/site-content", type: "json", dataKey: "toolGroups" },
  { id: "wealth-api", label: "理财数据", path: "/api/cex-yields", type: "json", dataKey: "campaigns" },
];

export function parseMaintainedAt(value) {
  if (!value) return Number.NaN;
  const normalized = String(value).replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+\(UTC\+8\)$/, "$1T$2:00+08:00");
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

export function getDataStatus(value) {
  const timestamp = parseMaintainedAt(value);
  if (!Number.isFinite(timestamp)) return { updatedAt: value || null, stale: true, ageHours: null };
  const ageMs = Math.max(0, Date.now() - timestamp);
  return { updatedAt: new Date(timestamp).toISOString(), stale: ageMs > DATA_STALE_AFTER_MS, ageHours: Math.floor(ageMs / 3600000) };
}

async function checkTarget(origin, target) {
  const startedAt = Date.now();
  const url = new URL(target.path, origin).href;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { accept: target.type === "json" ? "application/json" : "text/html", "user-agent": "EthanWeb3Hub-Health/1.0" },
    });
    const contentType = response.headers.get("content-type") || "";
    let valid = response.ok;
    let count = null;
    let dataStatus = null;
    if (response.ok && target.type === "json") {
      const payload = await response.json();
      valid = Array.isArray(payload?.[target.dataKey]);
      count = valid ? payload[target.dataKey].length : null;
      dataStatus = getDataStatus(payload?.updatedAt);
    } else if (response.ok) {
      const body = await response.text();
      valid = contentType.includes("text/html") && body.includes(target.expected);
    }
    return {
      id: target.id,
      label: target.label,
      path: target.path,
      status: response.status,
      reachable: response.ok,
      valid,
      stale: dataStatus?.stale || false,
      updatedAt: dataStatus?.updatedAt || null,
      count,
      durationMs: Date.now() - startedAt,
      error: valid ? "" : "响应内容不符合预期",
    };
  } catch (error) {
    return {
      id: target.id,
      label: target.label,
      path: target.path,
      status: 0,
      reachable: false,
      valid: false,
      stale: false,
      updatedAt: null,
      count: null,
      durationMs: Date.now() - startedAt,
      error: String(error?.message || error).slice(0, 180),
    };
  }
}

export async function runSiteHealthMonitor(kv, origin = "https://ethanweb3.com") {
  if (!kv) throw new Error("CEX_YIELDS KV binding is not configured");
  const checks = await Promise.all(SITE_CHECKS.map((target) => checkTarget(origin, target)));
  const report = {
    checkedAt: new Date().toISOString(),
    healthyCount: checks.filter((item) => item.reachable && item.valid && !item.stale).length,
    issueCount: checks.filter((item) => !item.reachable || !item.valid).length,
    staleCount: checks.filter((item) => item.stale).length,
    checks,
  };
  await kv.put(SITE_HEALTH_KEY, JSON.stringify(report));
  return report;
}
