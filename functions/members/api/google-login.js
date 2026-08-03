import { getMember, hashText, json } from "../../../lib/content-library.js";
import { cookieValue, verifyGoogleCredential } from "../../../lib/google-auth.js";
import { clearLoginFailures, getLoginThrottle, recordLoginFailure } from "../../../lib/member-security.js";

function clearNonceCookie() {
  return "ethan_google_nonce=; Path=/members/api/google-login; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

export async function onRequestPost({ request, env }) {
  if (!env.CONTENT_DB) return json({ error: "会员数据库尚未连接。" }, { status: 501 });
  const clientId = String(env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) return json({ error: "Google 登录尚未完成配置。" }, { status: 503 });
  const url = new URL(request.url);
  const origin = request.headers.get("origin") || "";
  if (url.hostname === "ethanweb3.com" && origin !== "https://ethanweb3.com") {
    return json({ error: "登录请求来源无效。" }, { status: 403 });
  }

  const nonce = cookieValue(request, "ethan_google_nonce");
  if (!nonce) return json({ error: "登录请求已经失效，请刷新页面后重试。" }, { status: 400 });
  try {
    const input = await request.json();
    const identity = await verifyGoogleCredential(input.credential, { clientId, nonce });
    const throttle = await getLoginThrottle(env.CONTENT_DB, request, identity.email);
    if (throttle.retryAfter) return json({ error: "尝试次数过多，请在15分钟后再试。" }, { status: 429, headers: { "retry-after": String(throttle.retryAfter), "set-cookie": clearNonceCookie() } });

    let member = await env.CONTENT_DB.prepare("SELECT * FROM members WHERE google_sub = ? LIMIT 1").bind(identity.sub).first();
    if (!member) {
      member = await env.CONTENT_DB.prepare("SELECT * FROM members WHERE email = ? LIMIT 1").bind(identity.email).first();
      if (member?.google_sub && member.google_sub !== identity.sub) member = null;
      if (member && !member.google_sub) {
        await env.CONTENT_DB.prepare("UPDATE members SET google_sub = ?, updated_at = ? WHERE id = ? AND (google_sub IS NULL OR google_sub = '')")
          .bind(identity.sub, new Date().toISOString(), member.id).run();
        member = await env.CONTENT_DB.prepare("SELECT * FROM members WHERE id = ? AND google_sub = ? LIMIT 1").bind(member.id, identity.sub).first();
      }
    }
    if (!member) {
      await recordLoginFailure(env.CONTENT_DB, throttle.keys);
      return json({ error: "这个 Google 邮箱尚未开通会员，请联系管理员登记同一个邮箱。" }, { status: 403, headers: { "set-cookie": clearNonceCookie() } });
    }
    const access = await getMember(env, member.email);
    if (!access?.allowed) {
      const error = access?.expired ? "会员已经到期，请联系管理员续期。" : access?.notStarted ? "会员权限尚未开始。" : "会员权限目前已暂停。";
      return json({ error }, { status: 403, headers: { "set-cookie": clearNonceCookie() } });
    }

    const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    const tokenHash = await hashText(token);
    const now = new Date();
    const expires = new Date(Math.min(now.getTime() + 7 * 24 * 60 * 60 * 1000, access.expires_at ? Date.parse(access.expires_at) : Infinity));
    await clearLoginFailures(env.CONTENT_DB, throttle.keys);
    await env.CONTENT_DB.batch([
      env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE expires_at <= ?").bind(now.toISOString()),
      env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE email = ?").bind(member.email),
      env.CONTENT_DB.prepare("INSERT INTO member_sessions (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, member.email, expires.toISOString(), now.toISOString()),
    ]);
    const headers = new Headers();
    headers.append("set-cookie", `ethan_member_session=${token}; Path=/members; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(60, Math.floor((expires.getTime() - now.getTime()) / 1000))}`);
    headers.append("set-cookie", clearNonceCookie());
    return json({ ok: true }, { headers });
  } catch (error) {
    return json({ error: error.message || "Google 登录失败，请重试。" }, { status: 400, headers: { "set-cookie": clearNonceCookie() } });
  }
}
