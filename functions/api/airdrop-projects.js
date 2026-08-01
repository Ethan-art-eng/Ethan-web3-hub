import { isAdminAuthorized } from "../../lib/admin-auth.js";

const DATA_KEY = "airdrop-projects";
const BACKUP_PREFIX = "airdrop-projects-backup:";
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

async function loadSeed(env, request) {
  const response = await env.ASSETS.fetch(new URL("/data/airdrop-projects.json", request.url));
  if (!response.ok) throw new Error("Airdrop seed data is missing");
  return response.json();
}

async function loadData(env, request) {
  const stored = env.CEX_YIELDS ? await env.CEX_YIELDS.get(DATA_KEY, "json") : null;
  return stored ? { ...stored, source: "kv" } : { ...(await loadSeed(env, request)), source: "seed" };
}

function cleanText(value, limit = 500) {
  return String(value ?? "").trim().slice(0, limit);
}

function validUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validate(payload) {
  if (!payload || !Array.isArray(payload.projects)) return "projects must be an array";
  if (payload.projects.length > 500) return "projects cannot contain more than 500 items";
  const ids = new Set();
  for (const project of payload.projects) {
    if (!project || !/^[a-z0-9][a-z0-9-]{2,79}$/i.test(String(project.id || ""))) return "every project needs a valid id";
    if (ids.has(project.id)) return `duplicate project id: ${project.id}`;
    if (!/^20\d{2}$/.test(String(project.year || ""))) return `invalid year for ${project.id}`;
    if (!cleanText(project.name, 120)) return `name is required for ${project.id}`;
    if (!["进行中", "已空投"].includes(project.status)) return `invalid status for ${project.id}`;
    if (!validUrl(cleanText(project.link, 1500))) return `invalid link for ${project.id}`;
    ids.add(project.id);
  }
  return null;
}

function clean(payload) {
  return {
    updatedAt: new Date().toISOString(),
    projects: payload.projects.map((project) => ({
      id: cleanText(project.id, 80),
      year: cleanText(project.year, 4),
      name: cleanText(project.name, 120),
      category: cleanText(project.category),
      funding: cleanText(project.funding),
      investors: cleanText(project.investors, 800),
      cost: cleanText(project.cost),
      accounts: cleanText(project.accounts),
      status: project.status === "已空投" ? "已空投" : "进行中",
      profit: cleanText(project.profit),
      link: cleanText(project.link, 1500),
      note: cleanText(project.note, 1200),
    })),
  };
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
