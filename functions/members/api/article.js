import { cleanSlug, getMember, getMemberEmail, json } from "../../../lib/content-library.js";

export async function onRequestGet({ request, env }) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ error: "请先完成邮箱验证。" }, { status: 401 });
  const slug = cleanSlug(new URL(request.url).searchParams.get("slug"));
  const article = await env.CONTENT_DB?.prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published' LIMIT 1").bind(slug).first();
  if (!article) return json({ error: "文章不存在。" }, { status: 404 });
  if (article.access_level === "member") {
    const member = await getMember(env, email);
    if (!member?.allowed) return json({ error: "该文章仅限有效会员阅读。" }, { status: 403 });
  }
  return json({ article });
}
