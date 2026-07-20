import { cleanEmail, cleanText, getMember, hashText, json } from "../../../lib/content-library.js";

export async function onRequestPost({ request, env }) {
  if (!env.CONTENT_DB) return json({ error: "会员数据库尚未连接。" }, { status: 501 });
  try {
    const input = await request.json();
    const email = cleanEmail(input.email);
    const code = cleanText(input.code, 80);
    if (!email || code.length < 8) return json({ error: "邮箱或会员码不正确。" }, { status: 401 });
    const member = await env.CONTENT_DB.prepare("SELECT access_code_hash FROM members WHERE email = ? LIMIT 1").bind(email).first();
    const codeHash = await hashText(`${email}:${code}`);
    if (!member?.access_code_hash || member.access_code_hash !== codeHash) return json({ error: "邮箱或会员码不正确。" }, { status: 401 });
    const access = await getMember(env, email);
    if (!access?.allowed) return json({ error: access?.expired ? "会员已经到期，请联系管理员续期。" : "会员权限目前已暂停。" }, { status: 403 });
    const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    const tokenHash = await hashText(token);
    const now = new Date();
    const expires = new Date(Math.min(now.getTime() + 30 * 24 * 60 * 60 * 1000, access.expires_at ? Date.parse(access.expires_at) : Infinity));
    await env.CONTENT_DB.batch([
      env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE expires_at <= ?").bind(now.toISOString()),
      env.CONTENT_DB.prepare("INSERT INTO member_sessions (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, email, expires.toISOString(), now.toISOString()),
    ]);
    return json({ ok: true }, { headers: { "set-cookie": `ethan_member_session=${token}; Path=/members; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(60, Math.floor((expires.getTime() - now.getTime()) / 1000))}` } });
  } catch (error) {
    return json({ error: error.message || "登录失败。" }, { status: 400 });
  }
}
