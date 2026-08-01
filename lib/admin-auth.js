let accessKeys = { expiresAt: 0, values: new Map() };

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeJson(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    return null;
  }
}

async function secureEqual(left, right) {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

async function getAccessKey(teamDomain, kid) {
  const now = Date.now();
  if (accessKeys.expiresAt <= now || !accessKeys.values.has(kid)) {
    const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Unable to load Cloudflare Access signing keys");
    const payload = await response.json();
    const values = new Map((payload.keys || []).filter((key) => key.kid).map((key) => [key.kid, key]));
    accessKeys = { expiresAt: now + 10 * 60 * 1000, values };
  }
  const jwk = accessKeys.values.get(kid);
  if (!jwk) return null;
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function verifyAccessJwt(jwt, env) {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (!header || !payload || header.alg !== "RS256" || !header.kid) return null;

    const teamDomain = String(env.ACCESS_TEAM_DOMAIN || "").trim().toLowerCase();
    const expectedAudience = String(env.ACCESS_AUD || "").trim();
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain) || !expectedAudience) return null;
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const now = Math.floor(Date.now() / 1000);
    if (!audience.includes(expectedAudience) || Number(payload.exp) <= now || (payload.nbf && Number(payload.nbf) > now)) return null;

    const key = await getAccessKey(teamDomain, header.kid);
    if (!key) return null;
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? payload : null;
  } catch {
    return null;
  }
}

export async function isAdminAuthorized(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (env.ADMIN_TOKEN && await secureEqual(suppliedToken, env.ADMIN_TOKEN)) return true;

  const url = new URL(request.url);
  if (env.ACCESS_AUTH_ENABLED !== "true" || url.hostname !== "ethanweb3.com") return false;
  const accessJwt = request.headers.get("cf-access-jwt-assertion") || "";
  const payload = accessJwt ? await verifyAccessJwt(accessJwt, env) : null;
  const expectedEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(payload?.email && expectedEmail && String(payload.email).trim().toLowerCase() === expectedEmail);
}
