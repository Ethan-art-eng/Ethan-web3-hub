import { isAdminAuthorized } from "../../lib/admin-auth.js";
import { cleanText, json } from "../../lib/content-library.js";

export async function onRequestPost({ request, env }) {
  if (!isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.STREAM) return json({ error: "Cloudflare Stream 尚未启用。" }, { status: 501 });
  try {
    const input = await request.json();
    const name = cleanText(input.name, 180) || "会员视频";
    const maxDurationSeconds = Math.min(21600, Math.max(60, Number(input.maxDurationSeconds) || 3600));
    const upload = await env.STREAM.createDirectUpload({
      maxDurationSeconds,
      expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      creator: "ethan-admin",
      meta: { name, source: "member-course-admin" },
      allowedOrigins: ["ethanweb3.com", "www.ethanweb3.com"],
      requireSignedURLs: true,
    });
    return json({ ok: true, id: upload.id, uploadURL: upload.uploadURL });
  } catch (error) {
    return json({ error: error.message || "无法创建视频上传地址" }, { status: error.statusCode || 400 });
  }
}
