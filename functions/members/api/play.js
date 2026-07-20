import { getMember, getMemberEmail, json, tierAllows } from "../../../lib/content-library.js";

export async function onRequestGet({ request, env }) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ error: "请先完成邮箱验证。" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[a-z0-9-]{3,80}$/i.test(id)) return json({ error: "课时不存在。" }, { status: 404 });
  if (!env.CONTENT_DB || !env.STREAM) return json({ error: "视频服务尚未连接。" }, { status: 501 });
  try {
    const lesson = await env.CONTENT_DB.prepare(`SELECT l.*, c.access_level AS course_access, c.status AS course_status
      FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? LIMIT 1`).bind(id).first();
    if (!lesson || lesson.status !== "published" || lesson.course_status !== "published" || !lesson.stream_uid) return json({ error: "视频尚未发布。" }, { status: 404 });
    const member = await getMember(env, email);
    const allowed = lesson.access_level === "free" || tierAllows(member, lesson.course_access);
    if (!allowed) return json({ error: member ? "当前会员等级没有该课程权限。" : "该视频仅限会员观看。" }, { status: 403 });
    const token = await env.STREAM.video(lesson.stream_uid).generateToken();
    return json({ ok: true, title: lesson.title, iframeUrl: `https://iframe.videodelivery.net/${token}` });
  } catch (error) {
    return json({ error: error.message || "暂时无法播放视频。" }, { status: error.statusCode || 500 });
  }
}
