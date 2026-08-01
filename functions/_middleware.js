import {
  getFreshness,
  getAirdropDisplayStatus,
  getVisibleCampaigns,
  renderAirdropRows,
  renderCampaignRows,
  renderExchangeFilters,
  renderInitialDataScript,
} from "../lib/public-render.js";
import { loadStoredBarkerDataset } from "../lib/barker-yield-sync.js";

const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data: https://www.google.com https://*.videodelivery.net https://*.cloudflarestream.com; connect-src 'self' https://upload.videodelivery.net https://challenges.cloudflare.com; frame-src https://iframe.videodelivery.net https://*.cloudflarestream.com https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com https://player.bilibili.com https://v.qq.com https://player.youku.com; object-src 'none'; base-uri 'self'; form-action 'self' https://upload.videodelivery.net; frame-ancestors 'none'; upgrade-insecure-requests",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function secureResponse(response, pathname) {
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => headers.set(name, value));
  if (pathname.startsWith("/api/") || pathname.startsWith("/wealth/admin/")) {
    headers.set("cache-control", "no-store");
  } else if (/\.(?:css|js|svg|png|webp|jpg|jpeg)$/i.test(pathname) || pathname.startsWith("/assets/")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  } else if (headers.get("content-type")?.includes("text/html")) {
    headers.set("cache-control", "public, max-age=0, must-revalidate");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function loadData(context, key, seedPath) {
  if (key === "cex-yields" && context.env.CEX_YIELDS) {
    const barker = await loadStoredBarkerDataset(context.env.CEX_YIELDS);
    if (barker) return { ...barker, source: "barker" };
  }
  const stored = context.env.CEX_YIELDS ? await context.env.CEX_YIELDS.get(key, "json") : null;
  if (stored) return { ...stored, source: "kv" };
  const response = await context.env.ASSETS.fetch(new URL(seedPath, context.request.url));
  if (!response.ok) throw new Error(`Missing seed data: ${seedPath}`);
  return { ...(await response.json()), source: "seed" };
}

function setContent(content, html = false) {
  return { element(element) { element.setInnerContent(content, { html }); } };
}

function setFreshness(freshness) {
  return {
    element(element) {
      element.setAttribute("class", `data-freshness${freshness.stale ? " stale" : ""}`);
      element.setInnerContent(`<span>${freshness.stale ? "需要复核" : "数据已维护"}</span><strong>${freshness.label}</strong><small>${freshness.detail}</small>`, { html: true });
    },
  };
}

async function renderAirdropPage(context, response) {
  const data = await loadData(context, "airdrop-projects", "/data/airdrop-projects.json");
  const current = (data.projects || []).filter((item) => item.year === "2026");
  const statusCounts = current.reduce((counts, item) => {
    counts[getAirdropDisplayStatus(item)] += 1;
    return counts;
  }, { "进行中": 0, "已空投": 0, "待核验": 0 });
  const freshness = getFreshness(data.updatedAt);
  return new HTMLRewriter()
    .on("#airdropTableBody", setContent(renderAirdropRows(data.projects || []), true))
    .on("#summaryTotal", setContent(String(current.length)))
    .on("#summaryActive", setContent(String(statusCounts["进行中"])))
    .on("#summaryDone", setContent(String(statusCounts["已空投"])))
    .on("#summaryPending", setContent(String(statusCounts["待核验"])))
    .on("#airdropDataFreshness", setFreshness(freshness))
    .on("#airdropInitialData", setContent(renderInitialDataScript(data), true))
    .transform(response);
}

async function renderWealthPage(context, response) {
  const data = await loadData(context, "cex-yields", "/data/cex-yields.json");
  const visible = getVisibleCampaigns(data);
  const freshness = getFreshness(data.updatedAt);
  const rows = renderCampaignRows(data);
  return new HTMLRewriter()
    .on("#exchangeFilters", setContent(renderExchangeFilters(data.exchanges), true))
    .on("#campaignTableBody", setContent(rows || '<tr class="empty-row"><td colspan="4">暂无未到期的同步活动</td></tr>', true))
    .on("#verifiedCount", setContent(String(visible.length)))
    .on("#exchangeCount", setContent(String((data.exchanges || []).length || 5)))
    .on("#updatedAt", setContent(freshness.label))
    .on("#wealthDataFreshness", setFreshness(freshness))
    .on("#campaignDisclaimer", setContent(data.notice || "数据仅供研究，不构成投资建议。"))
    .on("#campaignSource", setContent(data.dataProvider === "Barker" ? "数据来源：Barker · 参与前请回到交易所确认" : "来源：站内记录 · 点击活动名称核验"))
    .on("#campaignInitialData", setContent(renderInitialDataScript(data), true))
    .transform(response);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "www.ethanweb3.com") {
    url.hostname = "ethanweb3.com";
    return secureResponse(Response.redirect(url.toString(), 301), url.pathname);
  }
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    url.pathname = "/wealth/admin/";
    return secureResponse(Response.redirect(url.toString(), 302), url.pathname);
  }
  const response = await context.next();
  if (context.request.method !== "GET" || !response.headers.get("content-type")?.includes("text/html")) return secureResponse(response, url.pathname);
  try {
    if (url.pathname === "/airdrops/" || url.pathname === "/airdrops") return secureResponse(await renderAirdropPage(context, response), url.pathname);
    if (url.pathname === "/wealth/" || url.pathname === "/wealth") return secureResponse(await renderWealthPage(context, response), url.pathname);
  } catch (error) {
    console.warn("Public page edge rendering failed; serving static fallback.", error);
  }
  return secureResponse(response, url.pathname);
}
