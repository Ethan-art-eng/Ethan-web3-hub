import { MONITOR_KEY, runYieldMonitor } from "../../lib/yield-monitor.js";
import { isAdminAuthorized } from "../../lib/admin-auth.js";

const DATA_KEY = "cex-yields";
const BACKUP_PREFIX = "cex-yields-backup:";
const BACKUP_TTL_SECONDS = 60 * 24 * 60 * 60;
const MAX_CAMPAIGNS = 200;
const MAX_TEXT_LENGTH = 300;

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

function isAuthorized(request, env) {
  return isAdminAuthorized(request, env);
}

async function loadSeed(env, request) {
  const seedUrl = new URL("/data/cex-yields.json", request.url);
  const response = await env.ASSETS.fetch(seedUrl);
  if (!response.ok) throw new Error("Seed data is missing");
  return response.json();
}

async function loadCampaigns(env, request) {
  if (env.CEX_YIELDS) {
    const stored = await env.CEX_YIELDS.get(DATA_KEY, "json");
    if (stored) return { ...stored, source: "kv" };
  }

  const seed = await loadSeed(env, request);
  return { ...seed, source: "seed" };
}

function isText(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isOptionalText(value, maxLength = MAX_TEXT_LENGTH) {
  return value === null || value === undefined || value === "" || (typeof value === "string" && value.length <= maxLength);
}

function isOptionalDate(value) {
  return value === null || value === undefined || value === "" || !Number.isNaN(Date.parse(value));
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.exchanges) || !Array.isArray(payload.campaigns)) {
    return "exchanges and campaigns must be arrays";
  }

  if (payload.exchanges.length !== 5) return "exactly five exchanges are required";
  if (payload.campaigns.length > MAX_CAMPAIGNS) return `campaigns cannot contain more than ${MAX_CAMPAIGNS} items`;

  const exchangeNames = new Set();
  for (const exchange of payload.exchanges) {
    if (!isText(exchange.name, 40) || !isText(exchange.shortName, 40)) return "every exchange needs a valid name and shortName";
    if (!isText(exchange.logo, 160) || !isHttpUrl(exchange.url)) return "every exchange needs a valid logo and official URL";
    exchangeNames.add(exchange.name.trim());
  }

  if (exchangeNames.size !== payload.exchanges.length) return "exchange names must be unique";

  const ids = new Set();
  for (const item of payload.campaigns) {
    const required = ["id", "exchange", "activity", "venue", "apy", "endTime", "lastVerifiedAt", "sourceUrl"];
    for (const key of required) {
      if (!isText(item[key], key === "sourceUrl" ? 500 : MAX_TEXT_LENGTH)) return `${key} is required for every campaign`;
    }

    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(item.id)) return `invalid campaign id: ${item.id}`;
    if (ids.has(item.id)) return `duplicate campaign id: ${item.id}`;
    if (!exchangeNames.has(item.exchange)) return `unsupported exchange: ${item.exchange}`;
    if (!isHttpUrl(item.sourceUrl)) return `invalid sourceUrl for ${item.id}`;
    if (!Number.isFinite(Number(item.apyValue)) || Number(item.apyValue) < 0 || Number(item.apyValue) > 100000) return `invalid apyValue for ${item.id}`;
    if (typeof item.published !== "boolean") return `published must be true or false for ${item.id}`;
    if (!isOptionalDate(item.startsAt)) return `invalid startsAt for ${item.id}`;
    if (!isOptionalDate(item.endAt)) return `invalid endAt for ${item.id}`;
    if (!isOptionalDate(item.lastVerifiedAt) || !item.lastVerifiedAt) return `invalid lastVerifiedAt for ${item.id}`;
    for (const key of ["productType", "eligibility", "region", "cap"]) {
      if (!isOptionalText(item[key])) return `${key} is too long for ${item.id}`;
    }
    ids.add(item.id);
  }

  return null;
}

function cleanPayload(payload) {
  return {
    updatedAt: new Date().toISOString(),
    notice: typeof payload.notice === "string" ? payload.notice.slice(0, 800).trim() : "",
    exchanges: payload.exchanges.map((item) => ({
      name: item.name.trim(),
      shortName: item.shortName.trim(),
      logo: item.logo.trim(),
      url: item.url.trim(),
    })),
    campaigns: payload.campaigns.map((item) => ({
      id: item.id.trim(),
      exchange: item.exchange.trim(),
      activity: item.activity.trim(),
      venue: item.venue.trim(),
      apy: item.apy.trim(),
      apyValue: Number(item.apyValue),
      productType: String(item.productType || "").trim(),
      eligibility: String(item.eligibility || "").trim(),
      region: String(item.region || "").trim(),
      cap: String(item.cap || "").trim(),
      published: item.published,
      startsAt: item.startsAt ? new Date(item.startsAt).toISOString() : null,
      endTime: item.endTime.trim(),
      endAt: item.endAt ? new Date(item.endAt).toISOString() : null,
      lastVerifiedAt: new Date(item.lastVerifiedAt).toISOString(),
      sourceUrl: item.sourceUrl.trim(),
    })),
  };
}

async function createBackup(env, data) {
  if (!data) return;
  const timestamp = new Date().toISOString();
  const key = `${BACKUP_PREFIX}${timestamp}:${crypto.randomUUID().slice(0, 8)}`;
  await env.CEX_YIELDS.put(key, JSON.stringify(data), { expirationTtl: BACKUP_TTL_SECONDS });
}

async function loadHistory(env) {
  const listed = await env.CEX_YIELDS.list({ prefix: BACKUP_PREFIX, limit: 30 });
  const keys = listed.keys.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 20);
  return Promise.all(keys.map(async ({ name }) => {
    const data = await env.CEX_YIELDS.get(name, "json");
    return {
      key: name,
      updatedAt: data?.updatedAt || name.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 24),
      campaigns: Array.isArray(data?.campaigns) ? data.campaigns.length : 0,
    };
  }));
}

function toPublicData(data) {
  return {
    ...data,
    campaigns: Array.isArray(data.campaigns) ? data.campaigns.filter((item) => item.published !== false) : [],
  };
}

async function handleWrite({ request, env }) {
  if (!env.CEX_YIELDS) return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
  if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const error = validatePayload(payload);
  if (error) return json({ error }, { status: 400 });

  const saved = cleanPayload(payload);
  const current = await env.CEX_YIELDS.get(DATA_KEY, "json");
  await createBackup(env, current);
  await env.CEX_YIELDS.put(DATA_KEY, JSON.stringify(saved));
  return json({ ok: true, data: { ...saved, source: "kv" } });
}

async function handleRestore({ request, env }) {
  if (!env.CEX_YIELDS) return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
  if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  if (!key.startsWith(BACKUP_PREFIX)) return json({ error: "Invalid backup key" }, { status: 400 });

  const restored = await env.CEX_YIELDS.get(key, "json");
  if (!restored) return json({ error: "Backup not found" }, { status: 404 });
  const error = validatePayload(restored);
  if (error) return json({ error: `Backup is invalid: ${error}` }, { status: 400 });

  const current = await env.CEX_YIELDS.get(DATA_KEY, "json");
  await createBackup(env, current);
  const saved = cleanPayload(restored);
  await env.CEX_YIELDS.put(DATA_KEY, JSON.stringify(saved));
  return json({ ok: true, data: { ...saved, source: "kv" } });
}

async function handleMonitorRun({ request, env }) {
  if (!env.CEX_YIELDS) return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
  if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    return json({ ok: true, data: await runYieldMonitor(env.CEX_YIELDS) });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const adminRequest = url.searchParams.get("admin") === "1" || url.searchParams.get("history") === "1" || url.searchParams.get("monitor") === "1";
    if (adminRequest && !isAuthorized(context.request, context.env)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    if (url.searchParams.get("history") === "1") {
      if (!context.env.CEX_YIELDS) return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
      return json({ revisions: await loadHistory(context.env) });
    }
    if (url.searchParams.get("monitor") === "1") {
      if (!context.env.CEX_YIELDS) return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
      return json((await context.env.CEX_YIELDS.get(MONITOR_KEY, "json")) || { checkedAt: null, changedCount: 0, issueCount: 0, exchanges: [] });
    }
    const data = await loadCampaigns(context.env, context.request);
    return json(adminRequest ? data : toPublicData(data));
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get("action") === "restore") return handleRestore(context);
  if (url.searchParams.get("action") === "monitor") return handleMonitorRun(context);
  return handleWrite(context);
}

export async function onRequestPut(context) {
  return handleWrite(context);
}
