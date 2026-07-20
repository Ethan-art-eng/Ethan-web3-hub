import { isAdminAuthorized } from "../../lib/admin-auth.js";
import { json, listLibrary, upsertArticle, upsertCourse, upsertLesson, upsertMember } from "../../lib/content-library.js";

const UPSERTS = { article: upsertArticle, course: upsertCourse, lesson: upsertLesson, member: upsertMember };
const TABLES = { article: "articles", course: "courses", lesson: "lessons", member: "members" };

export async function onRequestGet({ request, env }) {
  if (!isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    return json(await listLibrary(env));
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  if (!isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.CONTENT_DB) return json({ error: "CONTENT_DB is not configured" }, { status: 501 });
  try {
    const payload = await request.json();
    const handler = UPSERTS[payload.resource];
    if (!handler || !payload.record) return json({ error: "Invalid resource" }, { status: 400 });
    const id = await handler(env.CONTENT_DB, payload.record);
    return json({ ok: true, id, data: await listLibrary(env) });
  } catch (error) {
    const conflict = String(error.message || "").includes("UNIQUE constraint failed");
    return json({ error: conflict ? "邮箱或网址标识已被使用。" : error.message }, { status: conflict ? 409 : 400 });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!isAdminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!env.CONTENT_DB) return json({ error: "CONTENT_DB is not configured" }, { status: 501 });
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const id = url.searchParams.get("id") || "";
  const table = TABLES[resource];
  if (!table || !/^[a-z0-9-]{3,80}$/i.test(id)) return json({ error: "Invalid resource" }, { status: 400 });
  try {
    if (resource === "course") {
      await env.CONTENT_DB.batch([
        env.CONTENT_DB.prepare("DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ?)").bind(id),
        env.CONTENT_DB.prepare("DELETE FROM lessons WHERE course_id = ?").bind(id),
      ]);
    }
    if (resource === "lesson") {
      await env.CONTENT_DB.prepare("DELETE FROM lesson_progress WHERE lesson_id = ?").bind(id).run();
    }
    if (resource === "member") {
      const member = await env.CONTENT_DB.prepare("SELECT email FROM members WHERE id = ? LIMIT 1").bind(id).first();
      if (member?.email) await env.CONTENT_DB.batch([
        env.CONTENT_DB.prepare("DELETE FROM lesson_progress WHERE email = ?").bind(member.email),
        env.CONTENT_DB.prepare("DELETE FROM member_sessions WHERE email = ?").bind(member.email),
      ]);
    }
    await env.CONTENT_DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return json({ ok: true, data: await listLibrary(env) });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
}
