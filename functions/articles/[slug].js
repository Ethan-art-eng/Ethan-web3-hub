import { cleanSlug } from "../../lib/content-library.js";

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function page(article) {
  const cover = article.cover_url ? `<img class="article-cover" src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.title)}">` : "";
  const canonical = `https://ethanweb3.com/articles/${encodeURIComponent(article.slug)}/`;
  const published = String(article.published_at || article.created_at || "").slice(0, 10);
  const updated = String(article.updated_at || article.published_at || article.created_at || "").slice(0, 10);
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.excerpt, mainEntityOfPage: canonical, datePublished: published, dateModified: updated, author: { "@type": "Person", name: "Ethan" }, publisher: { "@type": "Organization", name: "躺赚笔记", url: "https://ethanweb3.com/" }, ...(article.cover_url ? { image: article.cover_url } : {}) }).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="${escapeHtml(article.excerpt)}"><title>${escapeHtml(article.title)} | 躺赚笔记</title>
    <link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(article.title)}"><meta property="og:description" content="${escapeHtml(article.excerpt)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${escapeHtml(article.cover_url || "https://ethanweb3.com/assets/courses/tutorial-og.png")}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${schema}</script>
    <link rel="stylesheet" href="/styles.css?v=20260720-learning-v2"><link rel="stylesheet" href="/ui-system.css?v=20260720-learning-v2"><link rel="stylesheet" href="/articles/article.css?v=20260720-learning-v2"></head>
    <body><header class="site-header"><a class="brand" href="/"><span class="brand-mark">₿</span><span>躺赚笔记</span></a><nav class="nav"><a href="/airdrops/">空投项目</a><a href="/toolbox/">工具箱</a><a href="/wealth/">币圈理财</a><a class="active" aria-current="page" href="/courses/">教程</a></nav><a class="article-member-link" href="/members/">会员学习区</a></header>
    <main class="article-shell"><a class="article-back" href="/courses/">← 返回教程</a><article>
      <header class="article-heading"><span>${escapeHtml(article.category)}</span><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.excerpt)}</p><div class="article-trust"><span><strong>整理</strong>Ethan</span><span><strong>更新</strong>${escapeHtml(updated)}</span><span><strong>阅读</strong>${article.reading_minutes} 分钟</span><span><strong>用途</strong>教育与研究</span></div></header>
      ${cover}<div class="article-body">${article.body_html}</div>
    </article><aside class="article-disclaimer">内容仅用于研究和教育，不构成投资建议。请独立核验并控制风险。</aside></main>
    <footer class="site-footer"><strong>躺赚笔记</strong><span>用更清晰的方法理解市场。</span></footer><script src="/site-shell.js?v=20260720-learning-v2"></script></body></html>`;
}

export async function onRequestGet({ params, env }) {
  if (!env.CONTENT_DB) return new Response("Not found", { status: 404 });
  const slug = cleanSlug(params.slug);
  const article = await env.CONTENT_DB.prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published' LIMIT 1").bind(slug).first();
  if (!article) return new Response("Not found", { status: 404 });
  if (article.access_level === "member") return Response.redirect(`/members/?article=${encodeURIComponent(slug)}`, 302);
  return new Response(page(article), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}
