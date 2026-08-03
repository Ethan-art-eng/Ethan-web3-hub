import { json } from "../../../lib/content-library.js";

export async function onRequestGet({ env }) {
  const clientId = String(env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) return json({ error: "Google 登录正在配置中，请稍后再试。" }, { status: 503 });
  const nonce = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  return json({ clientId, nonce }, {
    headers: {
      "set-cookie": `ethan_google_nonce=${nonce}; Path=/members/api/google-login; HttpOnly; Secure; SameSite=Strict; Max-Age=600`,
    },
  });
}
