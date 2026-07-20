import { isAdminAuthorized } from "../../lib/admin-auth.js";
import { json } from "../../lib/content-library.js";

const TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"]]);

export async function onRequestPost({ request, env }) {
  if (!isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "请选择图片" }, { status: 400 });
    const ext = TYPES.get(file.type);
    if (!ext) return json({ error: "仅支持 JPG、PNG、WebP 或 GIF 图片" }, { status: 400 });
    if (env.MEDIA) {
      if (file.size > 8 * 1024 * 1024) return json({ error: "图片不能超过 8MB" }, { status: 413 });
      const key = `articles/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
      return json({ ok: true, url: `/media/${key}` });
    }
    if (!env.CONTENT_DB) return json({ error: "图片存储尚未连接。" }, { status: 501 });
    if (file.size > 750 * 1024) return json({ error: "当前封面图片请压缩到 750KB 以内。" }, { status: 413 });
    const id = `image-${crypto.randomUUID()}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await env.CONTENT_DB.prepare("INSERT INTO media_assets (id, content_type, data, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, file.type, bytes, new Date().toISOString()).run();
    return json({ ok: true, url: `/media-db/${id}` });
  } catch (error) {
    return json({ error: error.message || "图片上传失败" }, { status: 400 });
  }
}
