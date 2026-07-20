import { getMember, getMemberEmail, json, tierAllows } from "../../../lib/content-library.js";

export async function onRequestPost({ request, env }) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ error: "请先登录会员学习区。" }, { status: 401 });
  if (!env.CONTENT_DB) return json({ error: "会员数据库尚未连接。" }, { status: 501 });
  try {
    const input = await request.json();
    const lessonId = String(input.lessonId || "").trim();
    if (!/^[a-z0-9-]{3,80}$/i.test(lessonId)) return json({ error: "课时不存在。" }, { status: 404 });
    const lesson = await env.CONTENT_DB.prepare(`SELECT l.id, l.access_level, l.status, c.access_level AS course_access, c.status AS course_status
      FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? LIMIT 1`).bind(lessonId).first();
    if (!lesson || lesson.status !== "published" || lesson.course_status !== "published") return json({ error: "课时尚未发布。" }, { status: 404 });
    const member = await getMember(env, email);
    if (lesson.access_level !== "free" && !tierAllows(member, lesson.course_access)) return json({ error: "当前会员等级没有该课程权限。" }, { status: 403 });
    if (input.completed === false) {
      await env.CONTENT_DB.prepare("DELETE FROM lesson_progress WHERE email = ? AND lesson_id = ?").bind(email, lessonId).run();
    } else {
      const now = new Date().toISOString();
      await env.CONTENT_DB.prepare(`INSERT INTO lesson_progress (email, lesson_id, completed_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(email, lesson_id) DO UPDATE SET completed_at = excluded.completed_at, updated_at = excluded.updated_at`)
        .bind(email, lessonId, now, now).run();
    }
    return json({ ok: true, lessonId, completed: input.completed !== false });
  } catch (error) {
    return json({ error: error.message || "暂时无法保存学习进度。" }, { status: 400 });
  }
}
