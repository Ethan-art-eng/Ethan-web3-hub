import { getMember, getMemberEmail, json, tierAllows } from "../../../lib/content-library.js";

function externalEmbedUrl(value) {
  if (!/^https:\/\//i.test(value || "")) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const id = host === "youtube-nocookie.com" || url.pathname.startsWith("/embed/") ? url.pathname.split("/").filter(Boolean).pop() : url.searchParams.get("v");
      return /^[\w-]{6,20}$/.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).find((part) => /^\d{5,15}$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
    if (host === "bilibili.com" || host === "m.bilibili.com" || host === "player.bilibili.com") {
      const bvid = url.searchParams.get("bvid") || url.pathname.match(/\/(BV[\w]+)/i)?.[1];
      const aid = url.searchParams.get("aid");
      if (bvid && /^BV[\w]{8,20}$/i.test(bvid)) return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}`;
      if (aid && /^\d{3,20}$/.test(aid)) return `https://player.bilibili.com/player.html?aid=${aid}`;
      return "";
    }
    if (host === "v.qq.com") {
      const id = url.searchParams.get("vid") || url.pathname.match(/\/([a-z0-9]+)\.html$/i)?.[1];
      return /^[a-z0-9]{6,32}$/i.test(id || "") ? `https://v.qq.com/txp/iframe/player.html?vid=${id}` : "";
    }
    if (host === "v.youku.com" || host === "player.youku.com") {
      const id = url.pathname.match(/id_([\w=]+)\.html/i)?.[1] || url.pathname.match(/\/embed\/([\w=]+)/i)?.[1];
      return id ? `https://player.youku.com/embed/${encodeURIComponent(id)}` : "";
    }
  } catch {}
  return "";
}

export async function onRequestGet({ request, env }) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ error: "请先完成邮箱验证。" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[a-z0-9-]{3,80}$/i.test(id)) return json({ error: "课时不存在。" }, { status: 404 });
  if (!env.CONTENT_DB) return json({ error: "课程服务尚未连接。" }, { status: 501 });
  try {
    const lesson = await env.CONTENT_DB.prepare(`SELECT l.*, c.access_level AS course_access, c.status AS course_status
      FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? LIMIT 1`).bind(id).first();
    if (!lesson || lesson.status !== "published" || lesson.course_status !== "published" || !lesson.stream_uid) return json({ error: "视频尚未发布。" }, { status: 404 });
    const member = await getMember(env, email);
    const allowed = lesson.access_level === "free" || tierAllows(member, lesson.course_access);
    if (!allowed) return json({ error: member ? "当前会员等级没有该课程权限。" : "该视频仅限会员观看。" }, { status: 403 });
    const embedUrl = externalEmbedUrl(lesson.stream_uid);
    if (embedUrl) return json({ ok: true, title: lesson.title, iframeUrl: embedUrl });
    if (!env.STREAM_SERVICE || !env.ADMIN_TOKEN) return json({ error: "视频服务尚未连接。" }, { status: 501 });
    const tokenResponse = await env.STREAM_SERVICE.fetch("https://stream.internal/token", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.ADMIN_TOKEN}` },
      body: JSON.stringify({ videoId: lesson.stream_uid }),
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenPayload.token) throw new Error(tokenPayload.error || "无法生成播放凭证");
    return json({ ok: true, title: lesson.title, iframeUrl: `https://iframe.videodelivery.net/${tokenPayload.token}` });
  } catch (error) {
    return json({ error: error.message || "暂时无法播放视频。" }, { status: error.statusCode || 500 });
  }
}
