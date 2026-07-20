export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(init.headers || {}),
    },
  });
}

export function cleanText(value, limit = 1000) {
  return String(value ?? "").trim().slice(0, limit);
}

export function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function cleanSlug(value) {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function safeId(value, prefix) {
  const id = cleanText(value, 80);
  return /^[a-z0-9][a-z0-9-]{2,79}$/i.test(id) ? id : `${prefix}-${crypto.randomUUID()}`;
}

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function sanitizeRichHtml(value) {
  let html = String(value || "").slice(0, 250000);
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*\/?\s*>/gi, "");
  const allowed = new Set(["p", "br", "h2", "h3", "strong", "b", "em", "i", "ul", "ol", "li", "blockquote", "a", "img"]);
  html = html.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, rawTag, rawAttrs) => {
    const tag = rawTag.toLowerCase();
    if (!allowed.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag === "a") {
      const href = rawAttrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      const safeHref = /^(https?:\/\/|\/)/i.test(href) ? href : "";
      return safeHref ? `<a href="${escapeAttribute(safeHref)}" target="_blank" rel="noopener noreferrer">` : "<a>";
    }
    if (tag === "img") {
      const src = rawAttrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      const alt = rawAttrs.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || "";
      const safeSrc = /^(https?:\/\/|\/media\/|\/media-db\/)/i.test(src) ? src : "";
      return safeSrc ? `<img src="${escapeAttribute(safeSrc)}" alt="${escapeAttribute(alt)}" loading="lazy">` : "";
    }
    return `<${tag}>`;
  });
  return html.trim();
}

export async function hashText(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export async function getMemberEmail(request, env) {
  const accessEmail = request.headers.get("cf-access-authenticated-user-email");
  if (accessEmail) return cleanEmail(accessEmail);
  const host = new URL(request.url).hostname;
  if (host === "127.0.0.1" || host === "localhost") {
    const previewEmail = cleanEmail(request.headers.get("x-member-email"));
    if (previewEmail) return previewEmail;
  }
  const token = cookieValue(request, "ethan_member_session");
  if (token && env.CONTENT_DB) {
    const tokenHash = await hashText(token);
    const session = await env.CONTENT_DB.prepare("SELECT email FROM member_sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1").bind(tokenHash, new Date().toISOString()).first();
    if (session) return cleanEmail(session.email);
  }
  return "";
}

export async function getMember(env, email) {
  if (!env.CONTENT_DB || !email) return null;
  const member = await env.CONTENT_DB.prepare("SELECT * FROM members WHERE email = ? LIMIT 1").bind(email).first();
  if (!member) return null;
  const expired = Boolean(member.expires_at && Date.parse(member.expires_at) <= Date.now());
  return { ...member, allowed: member.status === "active" && !expired, expired };
}

export function tierAllows(member, required) {
  if (required === "free") return true;
  if (!member?.allowed) return false;
  if (required === "premium") return member.tier === "premium";
  return member.tier === "basic" || member.tier === "premium";
}

export async function listLibrary(env) {
  const db = env.CONTENT_DB;
  if (!db) throw new Error("CONTENT_DB is not configured");
  const [articles, courses, lessons, members] = await Promise.all([
    db.prepare("SELECT * FROM articles ORDER BY updated_at DESC").all(),
    db.prepare("SELECT * FROM courses ORDER BY sort_order, created_at").all(),
    db.prepare("SELECT * FROM lessons ORDER BY course_id, sort_order, created_at").all(),
    db.prepare("SELECT id, email, name, tier, status, starts_at, expires_at, notes, created_at, updated_at FROM members ORDER BY updated_at DESC").all(),
  ]);
  return { articles: articles.results || [], courses: courses.results || [], lessons: lessons.results || [], members: members.results || [] };
}

export async function upsertArticle(db, input) {
  const now = new Date().toISOString();
  const id = safeId(input.id, "article");
  const slug = cleanSlug(input.slug || input.title);
  const title = cleanText(input.title, 180);
  if (!slug || !title) throw new Error("文章标题和网址标识不能为空");
  const status = input.status === "published" ? "published" : "draft";
  const publishedAt = status === "published" ? cleanText(input.published_at, 40) || now : null;
  await db.prepare(`INSERT INTO articles (id, slug, title, excerpt, body_html, category, cover_url, status, access_level, reading_minutes, created_at, updated_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, excerpt=excluded.excerpt, body_html=excluded.body_html,
    category=excluded.category, cover_url=excluded.cover_url, status=excluded.status, access_level=excluded.access_level,
    reading_minutes=excluded.reading_minutes, updated_at=excluded.updated_at, published_at=excluded.published_at`)
    .bind(id, slug, title, cleanText(input.excerpt, 600), sanitizeRichHtml(input.body_html), cleanText(input.category, 80) || "投资基础",
      cleanText(input.cover_url, 1500), status, input.access_level === "member" ? "member" : "public",
      Math.min(120, Math.max(1, Number(input.reading_minutes) || 5)), cleanText(input.created_at, 40) || now, now, publishedAt).run();
  return id;
}

export async function upsertCourse(db, input) {
  const now = new Date().toISOString();
  const id = safeId(input.id, "course");
  const title = cleanText(input.title, 180);
  const slug = cleanSlug(input.slug || title);
  if (!title || !slug) throw new Error("课程名称和网址标识不能为空");
  const level = ["free", "basic", "premium"].includes(input.access_level) ? input.access_level : "basic";
  await db.prepare(`INSERT INTO courses (id, slug, title, description, cover_url, status, access_level, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, description=excluded.description, cover_url=excluded.cover_url,
    status=excluded.status, access_level=excluded.access_level, sort_order=excluded.sort_order, updated_at=excluded.updated_at`)
    .bind(id, slug, title, cleanText(input.description, 1200), cleanText(input.cover_url, 1500), input.status === "published" ? "published" : "draft",
      level, Number(input.sort_order) || 0, cleanText(input.created_at, 40) || now, now).run();
  return id;
}

export async function upsertLesson(db, input) {
  const now = new Date().toISOString();
  const id = safeId(input.id, "lesson");
  const courseId = cleanText(input.course_id, 80);
  const title = cleanText(input.title, 180);
  if (!courseId || !title) throw new Error("请选择课程并填写课时名称");
  await db.prepare(`INSERT INTO lessons (id, course_id, title, description, stream_uid, duration_minutes, status, access_level, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id, title=excluded.title, description=excluded.description,
    stream_uid=excluded.stream_uid, duration_minutes=excluded.duration_minutes, status=excluded.status,
    access_level=excluded.access_level, sort_order=excluded.sort_order, updated_at=excluded.updated_at`)
    .bind(id, courseId, title, cleanText(input.description, 800), cleanText(input.stream_uid, 160), Math.max(0, Number(input.duration_minutes) || 0),
      input.status === "published" ? "published" : "draft", input.access_level === "free" ? "free" : "member", Number(input.sort_order) || 0,
      cleanText(input.created_at, 40) || now, now).run();
  return id;
}

export async function upsertMember(db, input) {
  const now = new Date().toISOString();
  const id = safeId(input.id, "member");
  const email = cleanEmail(input.email);
  if (!email) throw new Error("请输入有效的会员邮箱");
  const expiry = cleanText(input.expires_at, 40) || null;
  if (expiry && Number.isNaN(Date.parse(expiry))) throw new Error("会员到期时间无效");
  const existing = await db.prepare("SELECT email, access_code_hash FROM members WHERE id = ? LIMIT 1").bind(id).first();
  const code = cleanText(input.access_code, 80);
  if (!existing && code.length < 8) throw new Error("新会员需要设置至少 8 位会员码");
  if (existing && existing.email !== email && code.length < 8) throw new Error("修改会员邮箱时需要同时重置会员码");
  const codeHash = code ? await hashText(`${email}:${code}`) : existing?.access_code_hash || "";
  await db.prepare(`INSERT INTO members (id, email, name, tier, status, starts_at, expires_at, notes, created_at, updated_at, access_code_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name, tier=excluded.tier, status=excluded.status,
    starts_at=excluded.starts_at, expires_at=excluded.expires_at, notes=excluded.notes, updated_at=excluded.updated_at, access_code_hash=excluded.access_code_hash`)
    .bind(id, email, cleanText(input.name, 120), input.tier === "premium" ? "premium" : "basic", input.status === "paused" ? "paused" : "active",
      cleanText(input.starts_at, 40) || now, expiry, cleanText(input.notes, 800), cleanText(input.created_at, 40) || now, now, codeHash).run();
  return id;
}
