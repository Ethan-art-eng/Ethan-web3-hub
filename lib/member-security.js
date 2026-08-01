import { hashText } from "./content-library.js";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_IP_FAILURES = 5;
const MAX_ACCOUNT_FAILURES = 10;

function clientIp(request) {
  return (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

async function attemptKeys(request, email) {
  const ipHash = await hashText(clientIp(request));
  const emailHash = await hashText(email || "invalid");
  return [`ip:${ipHash}`, `account:${emailHash}`];
}

function activeLock(row, nowMs) {
  const lockedUntil = row?.locked_until ? Date.parse(row.locked_until) : 0;
  return Number.isFinite(lockedUntil) && lockedUntil > nowMs ? lockedUntil : 0;
}

export async function getLoginThrottle(db, request, email) {
  const keys = await attemptKeys(request, email);
  const rows = await Promise.all(keys.map((key) => db.prepare(
    "SELECT locked_until FROM member_login_attempts WHERE attempt_key = ? LIMIT 1",
  ).bind(key).first()));
  const nowMs = Date.now();
  const lockedUntil = Math.max(...rows.map((row) => activeLock(row, nowMs)), 0);
  return { keys, retryAfter: lockedUntil ? Math.max(1, Math.ceil((lockedUntil - nowMs) / 1000)) : 0 };
}

async function failureStatement(db, key, threshold, now) {
  const row = await db.prepare(
    "SELECT failed_count, window_started_at, locked_until FROM member_login_attempts WHERE attempt_key = ? LIMIT 1",
  ).bind(key).first();
  const windowStartedMs = row?.window_started_at ? Date.parse(row.window_started_at) : 0;
  const resetWindow = !Number.isFinite(windowStartedMs) || now.getTime() - windowStartedMs >= WINDOW_MS;
  const failedCount = resetWindow ? 1 : Number(row?.failed_count || 0) + 1;
  const windowStartedAt = resetWindow ? now.toISOString() : row.window_started_at;
  const existingLock = activeLock(row, now.getTime());
  const lockedUntil = failedCount >= threshold
    ? new Date(now.getTime() + LOCK_MS).toISOString()
    : existingLock ? new Date(existingLock).toISOString() : null;
  return db.prepare(`INSERT INTO member_login_attempts (attempt_key, failed_count, window_started_at, locked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(attempt_key) DO UPDATE SET failed_count=excluded.failed_count, window_started_at=excluded.window_started_at,
      locked_until=excluded.locked_until, updated_at=excluded.updated_at`)
    .bind(key, failedCount, windowStartedAt, lockedUntil, now.toISOString());
}

export async function recordLoginFailure(db, keys) {
  const now = new Date();
  const statements = await Promise.all([
    failureStatement(db, keys[0], MAX_IP_FAILURES, now),
    failureStatement(db, keys[1], MAX_ACCOUNT_FAILURES, now),
  ]);
  statements.push(db.prepare("DELETE FROM member_login_attempts WHERE updated_at < ?")
    .bind(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()));
  await db.batch(statements);
}

export async function clearLoginFailures(db, keys) {
  await db.batch(keys.map((key) => db.prepare("DELETE FROM member_login_attempts WHERE attempt_key = ?").bind(key)));
}

export async function verifyTurnstile(request, env, token) {
  const url = new URL(request.url);
  if (url.hostname !== "ethanweb3.com") return { ok: true };
  if (!env.TURNSTILE_SECRET_KEY) return { ok: false, error: "登录保护尚未完成配置，请稍后再试。" };
  const responseToken = String(token || "").trim();
  if (!responseToken) return { ok: false, error: "请先完成人机验证。" };

  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", responseToken);
  const ip = clientIp(request);
  if (ip !== "unknown") form.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const result = await response.json();
    const hostnameMatches = result.hostname === "ethanweb3.com" || result.hostname === "www.ethanweb3.com";
    return result.success && hostnameMatches && result.action === "member-login"
      ? { ok: true }
      : { ok: false, error: "人机验证未通过，请刷新后重试。" };
  } catch {
    return { ok: false, error: "暂时无法完成人机验证，请稍后再试。" };
  }
}
