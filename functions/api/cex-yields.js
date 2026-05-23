const DATA_KEY = "cex-yields";

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function isAuthorized(request, env) {
  const token = env.ADMIN_TOKEN;
  const authorization = request.headers.get("authorization");
  return Boolean(token && authorization === `Bearer ${token}`);
}

async function loadSeed(env, request) {
  const seedUrl = new URL("/data/cex-yields.json", request.url);
  const response = await env.ASSETS.fetch(seedUrl);
  if (!response.ok) {
    throw new Error("Seed data is missing");
  }
  return response.json();
}

async function loadCampaigns(env, request) {
  if (env.CEX_YIELDS) {
    const stored = await env.CEX_YIELDS.get(DATA_KEY, "json");
    if (stored) {
      return { ...stored, source: "kv" };
    }
  }

  const seed = await loadSeed(env, request);
  return { ...seed, source: "seed" };
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.campaigns)) {
    return "campaigns must be an array";
  }

  if (payload.campaigns.length > 50) {
    return "campaigns cannot contain more than 50 items";
  }

  const required = ["exchange", "asset", "product", "redemption", "status", "risk", "href"];
  for (const item of payload.campaigns) {
    for (const key of required) {
      if (typeof item[key] !== "string" || !item[key].trim()) {
        return `${key} is required for every campaign`;
      }
    }
  }

  return null;
}

async function handleWrite({ request, env }) {
  if (!env.CEX_YIELDS) {
    return json({ error: "CEX_YIELDS KV binding is not configured" }, { status: 501 });
  }

  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const error = validatePayload(payload);
  if (error) {
    return json({ error }, { status: 400 });
  }

  const saved = {
    updatedAt: payload.updatedAt || new Date().toISOString(),
    notice: payload.notice || "",
    campaigns: payload.campaigns,
  };

  await env.CEX_YIELDS.put(DATA_KEY, JSON.stringify(saved));
  return json({ ok: true, data: saved });
}

export async function onRequestGet(context) {
  try {
    return json(await loadCampaigns(context.env, context.request));
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  return handleWrite(context);
}

export async function onRequestPut(context) {
  return handleWrite(context);
}
