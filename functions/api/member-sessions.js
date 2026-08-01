import { isAdminAuthorized } from "../../lib/admin-auth.js";
import { cleanEmail, cleanText, json } from "../../lib/content-library.js";

export async function onRequestPost({ request, env }) {
  if (!await isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.CONTENT_DB) return json({ error: "CONTENT_DB is not configured" }, { status: 501 });
  try {
    const input = await request.json();
    const memberId = cleanText(input.memberId, 80);
    const directEmail = cleanEmail(input.email);
    const member = memberId
      ? await env.CONTENT_DB.prepare("SELECT email FROM members WHERE id = ? LIMIT 1").bind(memberId).first()
      : null;
    const email = cleanEmail(member?.email || directEmail);
    if (!email) return json({ error: "会员不存在。" }, { status: 404 });
    await env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE email = ?").bind(email).run();
    return json({ ok: true, email });
  } catch (error) {
    return json({ error: error.message || "无法退出会员设备。" }, { status: 400 });
  }
}
