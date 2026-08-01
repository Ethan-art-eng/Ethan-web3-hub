import { isAdminAuthorized } from "../../lib/admin-auth.js";

const DATA_KEY = "site-content";
const BACKUP_PREFIX = "site-content-backup:";
const BACKUP_TTL_SECONDS = 60 * 24 * 60 * 60;

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(init.headers || {}),
    },
  });
}

function cleanText(value, limit = 500) {
  return String(value ?? "").trim().slice(0, limit);
}

function validId(value) {
  return /^[a-z0-9][a-z0-9-]{2,79}$/i.test(String(value || ""));
}

function validUrl(value) {
  if (!value) return true;
  if (/^\/[a-z0-9/_-]*\/?$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validDate(value) {
  return !value || !Number.isNaN(Date.parse(value));
}

function cleanDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function validate(payload) {
  if (!payload || !Array.isArray(payload.featuredCampaigns) || !Array.isArray(payload.essentials) || !Array.isArray(payload.toolGroups) || !Array.isArray(payload.tutorials)) {
    return "featuredCampaigns, essentials, toolGroups and tutorials must be arrays";
  }
  if (payload.featuredCampaigns.length > 30 || payload.essentials.length > 30 || payload.toolGroups.length > 30 || payload.tutorials.length > 100) return "content limit exceeded";
  const ids = new Set();
  const checkId = (id) => {
    if (!validId(id) || ids.has(id)) return false;
    ids.add(id);
    return true;
  };
  const supportedPlatforms = new Set(["binance", "okx", "bybit", "bitget", "gate"]);
  for (const item of payload.featuredCampaigns) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (
      !checkId(item.id)
      || !supportedPlatforms.has(cleanText(item.platformKey, 20).toLowerCase())
      || !cleanText(item.activity, 120)
      || !cleanText(item.task, 180)
      || !validUrl(cleanText(item.sourceUrl, 1500))
      || !cleanText(item.sourceUrl, 1500)
      || tags.length > 6
      || !validDate(item.startsAt)
      || !validDate(item.endAt)
      || !validDate(item.lastVerifiedAt)
    ) return "invalid featured campaign";
    const start = Date.parse(item.startsAt || "");
    const end = Date.parse(item.endAt || "");
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) return "featured campaign end date must be after start date";
  }
  for (const item of payload.essentials) {
    if (!checkId(item.id) || !cleanText(item.name, 120) || !validUrl(cleanText(item.url, 1500))) return "invalid essential item";
  }
  let toolCount = 0;
  for (const group of payload.toolGroups) {
    if (!checkId(group.id) || !cleanText(group.title, 120) || !Array.isArray(group.items)) return "invalid tool group";
    toolCount += group.items.length;
    for (const item of group.items) {
      if (!checkId(item.id) || !cleanText(item.name, 120) || !validUrl(cleanText(item.url, 1500))) return "invalid tool item";
    }
  }
  if (toolCount > 300) return "too many tool items";
  for (const tutorial of payload.tutorials) {
    if (!checkId(tutorial.id) || !cleanText(tutorial.title, 160) || !validUrl(cleanText(tutorial.url, 1500))) return "invalid tutorial";
  }
  return null;
}

function clean(payload) {
  return {
    updatedAt: new Date().toISOString(),
    featuredCampaigns: payload.featuredCampaigns.map((item) => ({
      id: cleanText(item.id, 80), platformKey: cleanText(item.platformKey, 20).toLowerCase(), platform: cleanText(item.platform, 80),
      activity: cleanText(item.activity, 120), task: cleanText(item.task, 180), description: cleanText(item.description, 700),
      audience: cleanText(item.audience, 100), tags: (Array.isArray(item.tags) ? item.tags : []).slice(0, 6).map((tag) => cleanText(tag, 40)).filter(Boolean),
      startsAt: cleanDate(item.startsAt), endAt: cleanDate(item.endAt), lastVerifiedAt: cleanDate(item.lastVerifiedAt),
      sourceUrl: cleanText(item.sourceUrl, 1500), published: item.published !== false,
    })),
    essentials: payload.essentials.map((item) => ({
      id: cleanText(item.id, 80), type: cleanText(item.type, 40), name: cleanText(item.name, 120),
      description: cleanText(item.description, 600), code: cleanText(item.code, 120), url: cleanText(item.url, 1500),
    })),
    toolGroups: payload.toolGroups.map((group) => ({
      id: cleanText(group.id, 80), label: cleanText(group.label, 60), title: cleanText(group.title, 120),
      items: group.items.map((item) => ({ id: cleanText(item.id, 80), name: cleanText(item.name, 120), description: cleanText(item.description, 600), url: cleanText(item.url, 1500) })),
    })),
    tutorials: payload.tutorials.map((item) => ({
      id: cleanText(item.id, 80), stage: cleanText(item.stage, 20), title: cleanText(item.title, 160),
      description: cleanText(item.description, 800), audience: cleanText(item.audience, 160), url: cleanText(item.url, 1500),
    })),
  };
}

async function loadData(env, request) {
  const stored = env.CEX_YIELDS ? await env.CEX_YIELDS.get(DATA_KEY, "json") : null;
  const response = await env.ASSETS.fetch(new URL("/data/site-content.json", request.url));
  if (!response.ok) throw new Error("Site content seed data is missing");
  const seed = await response.json();
  if (stored) {
    return {
      ...stored,
      featuredCampaigns: Array.isArray(stored.featuredCampaigns) ? stored.featuredCampaigns : (seed.featuredCampaigns || []),
      source: "kv",
    };
  }
  return { ...seed, source: "seed" };
}

async function saveBackup(env, current) {
  if (!current || !env.CEX_YIELDS) return;
  const key = `${BACKUP_PREFIX}${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`;
  await env.CEX_YIELDS.put(key, JSON.stringify(current), { expirationTtl: BACKUP_TTL_SECONDS });
}

export async function onRequestGet(context) {
  try {
    const admin = new URL(context.request.url).searchParams.get("admin") === "1";
    if (admin && !await isAdminAuthorized(context.request, context.env)) return json({ error: "Unauthorized" }, { status: 401 });
    return json(await loadData(context.env, context.request));
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  if (!await isAdminAuthorized(context.request, context.env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!context.env.CEX_YIELDS) return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
  try {
    const payload = await context.request.json();
    const error = validate(payload);
    if (error) return json({ error }, { status: 400 });
    const current = await context.env.CEX_YIELDS.get(DATA_KEY, "json");
    await saveBackup(context.env, current);
    const saved = clean(payload);
    await context.env.CEX_YIELDS.put(DATA_KEY, JSON.stringify(saved));
    return json({ ok: true, data: { ...saved, source: "kv" } });
  } catch (error) {
    return json({ error: error.message || "Invalid request" }, { status: 400 });
  }
}
