export const MONITOR_KEY = "cex-yields-monitor";

export const YIELD_SOURCES = [
  { name: "Binance", shortName: "币安", url: "https://www.binance.com/en/earn" },
  {
    name: "OKX",
    shortName: "欧易",
    url: "https://www.okx.com/help/section/announcements-earn-and-loan",
    monitorUrl: "https://www.okx.com/en-us/help/simple-earn-bonus-rules-change-announcement",
  },
  {
    name: "Bybit",
    shortName: "Bybit",
    url: "https://announcements.bybit.com/en/?category=Earn",
    monitorUrls: [
      "https://api.bybit.com/v5/announcements/index?locale=en-US&tag=Earn&limit=20",
      "https://api.bytick.com/v5/announcements/index?locale=en-US&tag=Earn&limit=20",
    ],
  },
  { name: "Bitget", shortName: "Bitget", url: "https://www.bitget.com/earn" },
  { name: "Gate", shortName: "Gate", url: "https://www.gate.com/simple-earn" },
];

async function fingerprintContent(content) {
  const limited = content.slice(0, 500000);
  let normalized;

  try {
    const parsed = JSON.parse(limited);
    const list = parsed?.result?.list;
    normalized = Array.isArray(list)
      ? JSON.stringify(list.map((item) => ({
          title: item.title,
          url: item.url,
          type: item.type?.key,
          tags: item.tags,
          start: item.startDateTimestamp,
          end: item.endDateTimestamp,
          published: item.publishTime,
        })))
      : JSON.stringify(parsed);
  } catch {
    normalized = limited
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39|lt|gt);/gi, " ")
    .replace(/\b(?:today|yesterday|\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago)\b/gi, "")
    .replace(/\d+(?:[.,]\d+)*/g, "#")
    .replace(/\s+/g, " ")
    .trim();
    normalized = normalized.toLowerCase().split(" ").filter(Boolean).sort().join(" ");
  }
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function checkSource(source, previous) {
  const checkedAt = new Date().toISOString();
  try {
    const monitorUrls = source.monitorUrls || [source.monitorUrl || source.url];
    let response;
    for (const monitorUrl of monitorUrls) {
      response = await fetch(monitorUrl, {
        redirect: "follow",
        headers: {
          accept: "text/html,application/xhtml+xml,application/json",
          "user-agent": "EthanWeb3Hub-Monitor/1.0 (+https://ethanweb3.com)",
        },
      });
      if (response.ok) break;
    }
    const contentType = response.headers.get("content-type") || "";
    const content = /(text|json|javascript)/i.test(contentType) ? await response.text() : "";
    const fingerprint = content ? await fingerprintContent(content) : "";
    const previousFingerprint = previous?.fingerprint || "";

    return {
      name: source.name,
      shortName: source.shortName,
      url: source.url,
      checkedAt,
      reachable: response.ok,
      status: response.status,
      changed: Boolean(response.ok && fingerprint && previousFingerprint && fingerprint !== previousFingerprint),
      blocked: response.status === 403 || response.status === 520,
      fingerprint,
      error: response.ok ? "" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: source.name,
      shortName: source.shortName,
      url: source.url,
      checkedAt,
      reachable: false,
      status: 0,
      changed: false,
      blocked: false,
      fingerprint: previous?.fingerprint || "",
      error: String(error?.message || error).slice(0, 180),
    };
  }
}

export async function runYieldMonitor(kv) {
  if (!kv) throw new Error("CEX_YIELDS KV binding is not configured");
  const previous = await kv.get(MONITOR_KEY, "json");
  const previousByName = new Map((previous?.exchanges || []).map((item) => [item.name, item]));
  const exchanges = await Promise.all(YIELD_SOURCES.map((source) => checkSource(source, previousByName.get(source.name))));
  const report = {
    checkedAt: new Date().toISOString(),
    changedCount: exchanges.filter((item) => item.changed).length,
    issueCount: exchanges.filter((item) => !item.reachable && !item.blocked).length,
    blockedCount: exchanges.filter((item) => item.blocked).length,
    exchanges,
  };
  await kv.put(MONITOR_KEY, JSON.stringify(report));
  return report;
}
