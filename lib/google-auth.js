import { cleanEmail } from "./content-library.js";

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
let cachedKeys = null;
let cachedKeysExpiresAt = 0;

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function googleKeys() {
  if (cachedKeys && cachedKeysExpiresAt > Date.now()) return cachedKeys;
  const response = await fetch(GOOGLE_CERTS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) throw new Error("暂时无法连接 Google 身份验证服务。");
  const body = await response.json();
  cachedKeys = Array.isArray(body.keys) ? body.keys : [];
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  cachedKeysExpiresAt = Date.now() + Math.min(21600, Math.max(300, maxAge)) * 1000;
  return cachedKeys;
}

export function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export async function verifyGoogleCredential(credential, { clientId, nonce }) {
  const token = String(credential || "");
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 12000) throw new Error("Google 登录凭证无效，请重新登录。");

  let header;
  let payload;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
  } catch {
    throw new Error("Google 登录凭证无效，请重新登录。");
  }
  if (header.alg !== "RS256" || !header.kid) throw new Error("Google 登录凭证格式不受支持。");
  const jwk = (await googleKeys()).find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) {
    cachedKeys = null;
    cachedKeysExpiresAt = 0;
    throw new Error("Google 登录密钥刚刚更新，请再试一次。");
  }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("Google 登录签名验证失败，请重新登录。");

  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!GOOGLE_ISSUERS.has(payload.iss) || !audience.includes(clientId)) throw new Error("这个 Google 凭证不是签发给本站的。");
  if (!Number.isFinite(payload.exp) || payload.exp <= now || (payload.nbf && payload.nbf > now + 60)) throw new Error("Google 登录已经过期，请重新登录。");
  if (payload.nonce !== nonce) throw new Error("登录请求已经失效，请刷新页面后重试。");
  const email = cleanEmail(payload.email);
  if (!payload.sub || !email || payload.email_verified !== true) throw new Error("该 Google 邮箱尚未完成验证。");
  return { sub: String(payload.sub).slice(0, 255), email, name: String(payload.name || "").slice(0, 120) };
}
