import { cleanSlug } from "../../lib/content-library.js";

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function page(article) {
  const cover = article.cover_url ? `<img class="article-cover" src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.title)}">` : "";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="${escapeHtml(article.excerpt)}"><title>${escapeHtml(article.title)} | 躺赚笔记</title>
    <link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/ui-system.css"><link rel="stylesheet" href="/articles/article.css"></head>
    <body><header class="site-header"><a class="brand" href="/"><span class="brand-mark">₿</span><span>躺赚笔记</span></a><nav class="nav"><a href="/airdrops/">空投项目</a><a href="/toolbox/">工具箱</a><a href="/wealth/">币圈理财</a><a class="active" href="/courses/">教程</a></nav></header>
    <main class="article-shell"><a class="article-back" href="/courses/">← 返回教程</a><article>
      <header class="article-heading"><span>${escapeHtml(article.category)}</span><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.excerpt)}</p><small>${article.reading_minutes} 分钟阅读 · ${escapeHtml(String(article.published_at || "").slice(0, 10))}</small></header>
      ${cover}<div class="article-body">${article.body_html}</div>
    </article><aside class="article-disclaimer">内容仅用于研究和教育，不构成投资建议。请独立核验并控制风险。</aside></main>
    <footer class="site-footer"><strong>躺赚笔记</strong><span>用更清晰的方法理解市场。</span></footer><script src="/site-shell.js"></script></body></html>`;
}

export async function onRequestGet({ params, env }) {
  if (!env.CONTENT_DB) return new Response("Not found", { status: 404 });
  const slug = cleanSlug(params.slug);
  const article = await env.CONTENT_DB.prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published' LIMIT 1").bind(slug).first();
  if (!article) return new Response("Not found", { status: 404 });
  if (article.access_level === "member") return Response.redirect(`/members/?article=${encodeURIComponent(slug)}`, 302);
  return new Response(page(article), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}
