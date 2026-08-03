import { cleanEmail, cleanText, getMember, hashText, json } from "../../../lib/content-library.js";
import { clearLoginFailures, getLoginThrottle, recordLoginFailure, verifyTurnstile } from "../../../lib/member-security.js";

export async function onRequestPost({ request, env }) {
  if (String(env.MEMBER_CODE_LOGIN_ENABLED || "false") !== "true") {
    return json({ error: "会员码登录已停用，请使用 Google 邮箱登录。" }, { status: 410 });
  }
  if (!env.CONTENT_DB) return json({ error: "会员数据库尚未连接。" }, { status: 501 });
  try {
    const input = await request.json();
    const email = cleanEmail(input.email);
    const code = cleanText(input.code, 80);
    const turnstile = await verifyTurnstile(request, env, input.turnstileToken);
    if (!turnstile.ok) return json({ error: turnstile.error }, { status: 400 });
    const throttle = await getLoginThrottle(env.CONTENT_DB, request, email);
    if (throttle.retryAfter) return json({ error: "尝试次数过多，请在15分钟后再试。" }, { status: 429, headers: { "retry-after": String(throttle.retryAfter) } });
    if (!email || code.length < 8) {
      await recordLoginFailure(env.CONTENT_DB, throttle.keys);
      return json({ error: "邮箱或会员码不正确。" }, { status: 401 });
    }
    const member = await env.CONTENT_DB.prepare("SELECT access_code_hash FROM members WHERE email = ? LIMIT 1").bind(email).first();
    const codeHash = await hashText(`${email}:${code}`);
    if (!member?.access_code_hash || member.access_code_hash !== codeHash) {
      await recordLoginFailure(env.CONTENT_DB, throttle.keys);
      return json({ error: "邮箱或会员码不正确。" }, { status: 401 });
    }
    const access = await getMember(env, email);
    if (!access?.allowed) {
      const error = access?.expired ? "会员已经到期，请联系管理员续期。" : access?.notStarted ? "会员权限尚未开始。" : "会员权限目前已暂停。";
      return json({ error }, { status: 403 });
    }
    const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    const tokenHash = await hashText(token);
    const now = new Date();
    const expires = new Date(Math.min(now.getTime() + 7 * 24 * 60 * 60 * 1000, access.expires_at ? Date.parse(access.expires_at) : Infinity));
    await clearLoginFailures(env.CONTENT_DB, throttle.keys);
    await env.CONTENT_DB.batch([
      env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE expires_at <= ?").bind(now.toISOString()),
      env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE email = ?").bind(email),
      env.CONTENT_DB.prepare("INSERT INTO member_sessions (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, email, expires.toISOString(), now.toISOString()),
    ]);
    return json({ ok: true }, { headers: { "set-cookie": `ethan_member_session=${token}; Path=/members; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(60, Math.floor((expires.getTime() - now.getTime()) / 1000))}` } });
  } catch (error) {
    return json({ error: error.message || "登录失败。" }, { status: 400 });
  }
}
