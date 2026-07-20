import { getMember, getMemberEmail, json, tierAllows } from "../../../lib/content-library.js";

export async function onRequestGet({ request, env }) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ error: "请先完成邮箱验证。" }, { status: 401 });
  if (!env.CONTENT_DB) return json({ error: "会员数据库尚未连接。" }, { status: 501 });
  try {
    const member = await getMember(env, email);
    const [courseRows, lessonRows, progressRows] = await Promise.all([
      env.CONTENT_DB.prepare("SELECT * FROM courses WHERE status = 'published' ORDER BY sort_order, created_at").all(),
      env.CONTENT_DB.prepare("SELECT * FROM lessons WHERE status = 'published' ORDER BY course_id, sort_order, created_at").all(),
      env.CONTENT_DB.prepare("SELECT lesson_id, completed_at FROM lesson_progress WHERE email = ?").bind(email).all(),
    ]);
    const lessons = lessonRows.results || [];
    const completedLessons = new Map((progressRows.results || []).map((item) => [item.lesson_id, item.completed_at]));
    const courses = (courseRows.results || []).map((course) => {
      const courseAllowed = tierAllows(member, course.access_level);
      return {
        ...course,
        allowed: courseAllowed,
        lessons: lessons.filter((lesson) => lesson.course_id === course.id).map((lesson) => ({
          ...lesson,
          stream_uid: undefined,
          allowed: lesson.access_level === "free" || courseAllowed,
          completed: completedLessons.has(lesson.id),
          completed_at: completedLessons.get(lesson.id) || null,
        })),
      };
    });
    return json({ email, member: member ? { name: member.name, tier: member.tier, status: member.status, expires_at: member.expires_at, allowed: member.allowed, expired: member.expired } : null, courses });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
