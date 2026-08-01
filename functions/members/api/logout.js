import { hashText, json } from "../../../lib/content-library.js";

export async function onRequestPost({ request, env }) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("ethan_member_session="))?.slice(21) || "";
  if (token && env.CONTENT_DB) await env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE token_hash = ?").bind(await hashText(token)).run();
  return json({ ok: true }, { headers: { "set-cookie": "ethan_member_session=; Path=/members; HttpOnly; Secure; SameSite=Strict; Max-Age=0" } });
}
