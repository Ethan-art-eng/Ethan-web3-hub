import { getMember, getMemberEmail, json } from "../../../lib/content-library.js";

export async function onRequestGet({ request, env }) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ error: "登录已失效，账号可能已在另一台设备登录。" }, { status: 401 });
  const member = await getMember(env, email);
  if (!member?.allowed) return json({ error: "会员权限已暂停、尚未开始或已经到期。" }, { status: 403 });
  return json({ ok: true });
}
