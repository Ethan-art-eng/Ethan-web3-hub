import { isAdminAuthorized } from "../../lib/admin-auth.js";
import { cleanText, json } from "../../lib/content-library.js";

export async function onRequestPost({ request, env }) {
  if (!isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.STREAM_SERVICE || !env.ADMIN_TOKEN) return json({ error: "Cloudflare Stream 尚未启用。" }, { status: 501 });
  try {
    const input = await request.json();
    const name = cleanText(input.name, 180) || "会员视频";
    const maxDurationSeconds = Math.min(21600, Math.max(60, Number(input.maxDurationSeconds) || 3600));
    const response = await env.STREAM_SERVICE.fetch("https://stream.internal/upload", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.ADMIN_TOKEN}` },
      body: JSON.stringify({ name, maxDurationSeconds }),
    });
    const upload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(upload.error || "无法创建视频上传地址");
    return json(upload);
  } catch (error) {
    return json({ error: error.message || "无法创建视频上传地址" }, { status: error.statusCode || 400 });
  }
}
