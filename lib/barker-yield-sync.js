export const BARKER_DATA_KEY = "cex-yields-barker";
export const BARKER_SYNC_STATUS_KEY = "cex-yields-barker-status";
export const BARKER_CAMPAIGNS_URL = "https://app.barker.money/campaigns";

const MAX_HTML_LENGTH = 1_500_000;
const MAX_CAMPAIGNS = 100;

const EXCHANGE_META = {
  binance: {
    name: "Binance",
    shortName: "币安",
    logo: "/assets/exchanges/binance.svg",
    url: "https://www.binance.com/en/earn",
    officialHosts: ["binance.com"],
  },
  okx: {
    name: "OKX",
    shortName: "欧易",
    logo: "/assets/exchanges/okx.svg",
    url: "https://www.okx.com/en-us/earn/simple-earn",
    officialHosts: ["okx.com"],
  },
  bybit: {
    name: "Bybit",
    shortName: "Bybit",
    logo: "/assets/exchanges/bybit.svg",
    url: "https://www.bybit.com/en/earn/easy-earn/",
    officialHosts: ["bybit.com"],
  },
  bitget: {
    name: "Bitget",
    shortName: "Bitget",
    logo: "/assets/exchanges/bitget.svg",
    url: "https://www.bitget.com/earn",
    officialHosts: ["bitget.com"],
  },
  gate: {
    name: "Gate",
    shortName: "Gate",
    logo: "/assets/exchanges/gate.svg",
    url: "https://www.gate.com/simple-earn",
    officialHosts: ["gate.com", "gate.io"],
  },
  mexc: {
    name: "MEXC",
    shortName: "MEXC",
    logo: "/assets/exchanges/mexc.svg",
    url: "https://www.mexc.com/earn",
    officialHosts: ["mexc.com"],
  },
};

function findJsonArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error("Barker campaign marker was not found");
  const start = source.indexOf("[", markerIndex + marker.length);
  if (start < 0) throw new Error("Barker campaign array was not found");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("Barker campaign array was incomplete");
}

export function extractBarkerCampaigns(html) {
  if (typeof html !== "string" || !html.length || html.length > MAX_HTML_LENGTH) {
    throw new Error("Barker response size was invalid");
  }

  const scriptPattern = /<script[^>]*>self\.__next_f\.push\((\[.*?\])\)<\/script>/gs;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const payload = JSON.parse(match[1]);
      const chunk = payload?.[1];
      if (typeof chunk !== "string" || !chunk.includes("\"initialCampaigns\":")) continue;
      const campaigns = JSON.parse(findJsonArray(chunk, "\"initialCampaigns\":"));
      if (!Array.isArray(campaigns) || !campaigns.length || campaigns.length > MAX_CAMPAIGNS) {
        throw new Error("Barker campaign count was invalid");
      }
      return campaigns;
    } catch (error) {
      if (String(error?.message || "").startsWith("Barker")) throw error;
    }
  }
  throw new Error("Barker campaign data could not be decoded");
}

function cleanText(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanSymbol(value) {
  const symbol = cleanText(value, 32);
  return /^[\p{L}\p{N} .+_-]+$/u.test(symbol) ? symbol : "";
}

function toIsoDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function percentValue(value) {
  const decimal = Number(value);
  if (!Number.isFinite(decimal) || decimal < 0 || decimal > 10) return null;
  return Number((decimal * 100).toFixed(4));
}

function formatPercent(value) {
  const percentage = percentValue(value);
  if (percentage === null) return "";
  return `${percentage.toFixed(2)}%`;
}

function formatUsd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function productMeta(item) {
  if (item.product_type === "bonus_campaign") return { value: "Bonus", label: "奖励活动" };
  if (item.product_type === "onchain") return { value: "Onchain", label: "链上理财" };
  if (Number(item.lock_days) > 0) return { value: "Fixed", label: `定期 ${Number(item.lock_days)} 天` };
  return { value: "Flexible", label: "活期" };
}

function rewardFrequency(value) {
  const text = cleanText(value, 100);
  const lower = text.toLowerCase();
  if (lower === "daily") return "每日";
  if (lower === "hourly") return "每小时";
  if (lower === "every friday") return "每周五";
  if (lower === "every saturday") return "每周六";
  if (lower === "daily 08:00") return "每日 08:00";
  if (lower === "daily around 06:00 utc") return "每日约 06:00 UTC";
  return text;
}

function normalizeTiers(item) {
  if (!Array.isArray(item.tier_details)) return [];
  return item.tier_details.slice(0, 12).map((tier) => ({
    apyValue: percentValue(tier.apy),
    min: Number.isFinite(Number(tier.min)) ? Number(tier.min) : null,
    max: Number.isFinite(Number(tier.max)) ? Number(tier.max) : null,
  })).filter((tier) => tier.apyValue !== null);
}

function campaignCap(item, tiers) {
  const campaignApy = percentValue(item.campaign_apy);
  const matchingTier = tiers.find((tier) => Math.abs(tier.apyValue - campaignApy) < 0.0001);
  const tierCap = formatUsd(matchingTier?.max);
  if (tierCap) return `${tierCap} 内适用展示年化`;
  const directCap = formatUsd(item.max_amount) || formatUsd(item.tier_1_threshold);
  return directCap ? `${directCap} 参考额度` : "未标明固定额度";
}

function hostMatches(hostname, allowedHosts) {
  const normalized = hostname.toLowerCase();
  return allowedHosts.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function safeOfficialUrl(item, meta) {
  for (const candidate of [item.announcement_url, item.tutorial_url]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && hostMatches(url.hostname, meta.officialHosts)) return url.toString();
    } catch {
      // Ignore malformed or non-official links from the upstream record.
    }
  }
  return "";
}

function normalizeCampaign(item, syncedAt) {
  const protocol = cleanText(item.protocol_uid, 24).toLowerCase();
  const meta = EXCHANGE_META[protocol];
  const campaignId = Number(item.campaign_id ?? item.id);
  const symbol = cleanSymbol(item.campaign_name || item.asset_symbol);
  const apyValue = percentValue(item.campaign_apy);
  const updatedAt = toIsoDate(item.updated_at) || syncedAt;
  const startsAt = toIsoDate(item.start_date);
  const endAt = toIsoDate(item.end_date);
  if (!meta || !Number.isInteger(campaignId) || campaignId <= 0 || !symbol || apyValue === null || !updatedAt) return null;
  if (Number(item.is_cex) !== 1 || Number(item.is_active) !== 1 || cleanText(item.pool_status, 20).toLowerCase() !== "active") return null;
  if (cleanText(item.entry_point, 24).toLowerCase() !== "main_site") return null;
  if (endAt && Date.parse(endAt) < Date.now()) return null;

  const product = productMeta(item);
  const tiers = normalizeTiers(item);
  const providerUrl = `${BARKER_CAMPAIGNS_URL}/${campaignId}`;
  const officialUrl = safeOfficialUrl(item, meta);
  const rewardAsset = cleanSymbol(item.reward_asset);
  return {
    id: `barker-${protocol}-${campaignId}`,
    exchange: meta.name,
    activity: `${symbol} ${product.label}`,
    venue: `${meta.shortName} · 交易所主站`,
    apy: `${apyValue.toFixed(2)}%`,
    apyValue,
    baseApyValue: percentValue(item.base_apy),
    rewardApyValue: percentValue(item.reward_apy),
    rewardAsset,
    rewardFrequency: rewardFrequency(item.reward_distribution_date),
    redemptionDays: Number.isFinite(Number(item.redemption_days)) ? Number(item.redemption_days) : null,
    tierDetails: tiers,
    productType: product.value,
    eligibility: Number(item.is_new_user_only) === 1 ? "新用户专享" : Number(item.is_new) === 1 ? "新上线活动" : "以交易所账户页面为准",
    region: "以交易所账户页面为准",
    cap: campaignCap(item, tiers),
    published: true,
    startsAt,
    endTime: endAt || "长期活动",
    endAt,
    lastVerifiedAt: updatedAt,
    sourceUrl: officialUrl || providerUrl,
    sourceType: officialUrl ? "official" : "barker",
    providerUrl,
    dataOrigin: "barker",
  };
}

export function normalizeBarkerDataset(rawCampaigns, syncedAt = new Date().toISOString()) {
  const campaigns = rawCampaigns.map((item) => normalizeCampaign(item, syncedAt)).filter(Boolean);
  if (!campaigns.length) throw new Error("Barker returned no valid exchange campaigns");
  const seen = new Set();
  const unique = campaigns.filter((item) => !seen.has(item.id) && seen.add(item.id));
  const providerUpdatedAt = unique.slice(1).reduce((latest, item) => {
    return Date.parse(item.lastVerifiedAt) > Date.parse(latest) ? item.lastVerifiedAt : latest;
  }, unique[0].lastVerifiedAt);
  const presentExchanges = new Set(unique.map((item) => item.exchange));
  const exchanges = Object.values(EXCHANGE_META).filter((item) => presentExchanges.has(item.name)).map(({ officialHosts, ...item }) => item);
  return {
    updatedAt: syncedAt,
    notice: "活动数据自动同步自 Barker，仅展示交易所主站理财活动。APY、地区资格和活动状态可能变化。",
    dataProvider: "Barker",
    dataProviderUrl: BARKER_CAMPAIGNS_URL,
    sync: {
      status: "ok",
      provider: "Barker",
      providerUrl: BARKER_CAMPAIGNS_URL,
      syncedAt,
      providerUpdatedAt,
      intervalMinutes: 30,
      campaignCount: unique.length,
    },
    exchanges,
    campaigns: unique,
  };
}

export async function loadStoredBarkerDataset(kv) {
  if (!kv) return null;
  const [dataset, status] = await Promise.all([
    kv.get(BARKER_DATA_KEY, "json"),
    kv.get(BARKER_SYNC_STATUS_KEY, "json"),
  ]);
  if (!dataset || !Array.isArray(dataset.campaigns) || !dataset.campaigns.length || !Array.isArray(dataset.exchanges)) return null;
  return {
    ...dataset,
    sync: {
      ...dataset.sync,
      status: status?.status || dataset.sync?.status || "ok",
      lastAttemptAt: status?.attemptedAt || dataset.sync?.syncedAt || dataset.updatedAt,
    },
  };
}

export async function syncBarkerCampaigns(kv, fetcher = fetch) {
  if (!kv) throw new Error("CEX_YIELDS KV binding is not configured");
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetcher(BARKER_CAMPAIGNS_URL, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "EthanWeb3Hub-Sync/1.0 (+https://ethanweb3.com)",
      },
    });
    if (!response.ok) throw new Error(`Barker returned HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_LENGTH) throw new Error("Barker response was too large");
    const html = await response.text();
    const dataset = normalizeBarkerDataset(extractBarkerCampaigns(html), attemptedAt);
    await Promise.all([
      kv.put(BARKER_DATA_KEY, JSON.stringify(dataset)),
      kv.put(BARKER_SYNC_STATUS_KEY, JSON.stringify({ status: "ok", attemptedAt, syncedAt: attemptedAt, campaignCount: dataset.campaigns.length })),
    ]);
    return dataset;
  } catch (error) {
    await kv.put(BARKER_SYNC_STATUS_KEY, JSON.stringify({ status: "error", attemptedAt }));
    throw error;
  }
}
