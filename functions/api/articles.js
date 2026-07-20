import { json } from "../../lib/content-library.js";

export async function onRequestGet({ env }) {
  if (!env.CONTENT_DB) return json({ articles: [], courses: [] });
  try {
    const [articles, courses] = await Promise.all([
      env.CONTENT_DB.prepare(`SELECT slug, title, excerpt, category, cover_url, reading_minutes, published_at
        FROM articles WHERE status = 'published' AND access_level = 'public' ORDER BY published_at DESC`).all(),
      env.CONTENT_DB.prepare(`SELECT c.slug, c.title, c.description, c.cover_url, c.access_level,
        COUNT(l.id) AS lesson_count, COALESCE(SUM(l.duration_minutes), 0) AS duration_minutes
        FROM courses c LEFT JOIN lessons l ON l.course_id = c.id AND l.status = 'published'
        WHERE c.status = 'published' GROUP BY c.id ORDER BY c.sort_order, c.created_at`).all(),
    ]);
    return json({ articles: articles.results || [], courses: courses.results || [] }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}
