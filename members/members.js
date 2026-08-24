const grid = document.getElementById("memberCourseGrid");
const notice = document.getElementById("memberNotice");
const statusBox = document.getElementById("memberStatus");
const player = document.getElementById("memberPlayer");
const frame = document.getElementById("videoFrame");
const articleBox = document.getElementById("memberArticle");
const loginBox = document.getElementById("memberLogin");
const watermark = document.getElementById("videoWatermark");
let activeMemberEmail = "";
let heartbeatTimer = null;
let watermarkTimer = null;
let googleInitialized = false;

function escapeHtml(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function showNotice(message, type = "") { notice.hidden = false; notice.className = `member-notice ${type}`; notice.textContent = message; }
function levelLabel(level) { return level === "premium" ? "高级会员" : level === "basic" ? "正式会员" : "免费试看"; }

async function waitForGoogle() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (window.google?.accounts?.id) return window.google.accounts.id;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Google 登录服务加载失败，请刷新页面重试。");
}

async function initializeGoogleLogin() {
  if (googleInitialized) return;
  googleInitialized = true;
  const status = document.getElementById("memberLoginStatus");
  const button = document.getElementById("googleSignInButton");
  status.textContent = "正在加载 Google 登录…";
  try {
    const configResponse = await fetch("/members/api/auth-config", { cache: "no-store" });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok) throw new Error(config.error || "Google 登录尚未完成配置。");
    const googleIdentity = await waitForGoogle();
    googleIdentity.initialize({
      client_id: config.clientId,
      nonce: config.nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: async ({ credential }) => {
        status.textContent = "正在核对会员权限…";
        try {
          const response = await fetch("/members/api/google-login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Google 登录失败，请重试。");
          location.assign("/members/");
        } catch (error) {
          const message = error.message;
          googleInitialized = false;
          await initializeGoogleLogin();
          status.textContent = message;
        }
      },
    });
    button.innerHTML = "";
    googleIdentity.renderButton(button, { theme: "outline", size: "large", shape: "rectangular", text: "signin_with", width: 320, locale: "zh-CN" });
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
    googleInitialized = false;
  }
}

function moveWatermark() {
  watermark.style.left = `${5 + Math.floor(Math.random() * 42)}%`;
  watermark.style.top = `${7 + Math.floor(Math.random() * 70)}%`;
}

function startWatermark() {
  clearInterval(watermarkTimer);
  watermark.textContent = activeMemberEmail ? `仅限 ${activeMemberEmail} 本人学习` : "会员专享内容";
  moveWatermark();
  watermarkTimer = setInterval(moveWatermark, 12000);
}

function stopPlayback() {
  clearInterval(watermarkTimer);
  watermarkTimer = null;
  frame.src = "about:blank";
  player.hidden = true;
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    try {
      const response = await fetch("/members/api/heartbeat", { cache: "no-store" });
      if (!response.ok) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        stopPlayback();
        location.reload();
      }
    } catch {}
  }, 30000);
}

function renderCourses(courses) {
  grid.innerHTML = courses.length ? courses.map((course) => `<article class="member-course-card${course.allowed ? "" : " is-locked"}">
    <div class="member-course-cover">${course.cover_url ? `<img class="member-course-cover-image" src="${escapeHtml(course.cover_url)}" alt="${escapeHtml(course.title)}" loading="lazy">` : ""}<span>${course.allowed ? "可学习" : "需权限"}</span></div>
    <div class="member-course-copy"><small>${levelLabel(course.access_level)}</small><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description)}</p>
      ${course.lessons.length ? `<div class="member-course-progress"><span><b style="width:${Math.round(course.lessons.filter((lesson) => lesson.completed).length / course.lessons.length * 100)}%"></b></span><small>已完成 ${course.lessons.filter((lesson) => lesson.completed).length} / ${course.lessons.length} 课时</small></div>` : ""}
      <div class="member-lessons">${course.lessons.length ? course.lessons.map((lesson, index) => `<div class="member-lesson-row${lesson.completed ? " is-complete" : ""}"><button class="member-lesson-play" type="button" data-lesson="${escapeHtml(lesson.id)}" ${lesson.allowed ? "" : "disabled"}><span><i>${String(index + 1).padStart(2, "0")}</i><strong>${escapeHtml(lesson.title)}</strong></span><em>${lesson.allowed ? `${lesson.duration_minutes || "—"} 分钟` : "已锁定"}</em></button><button class="member-lesson-complete" type="button" data-progress="${escapeHtml(lesson.id)}" data-completed="${lesson.completed ? "true" : "false"}" ${lesson.allowed ? "" : "disabled"} aria-label="${lesson.completed ? "取消完成" : "标记完成"}：${escapeHtml(lesson.title)}">${lesson.completed ? "✓" : "○"}</button></div>`).join("") : '<p class="member-empty">课程内容正在准备。</p>'}</div>
    </div></article>`).join("") : '<p class="member-empty">课程库还没有已发布内容。</p>';
}

async function loadArticle(slug) {
  const response = await fetch(`/members/api/article?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { showNotice(data.error || "无法读取文章", "error"); return; }
  const article = data.article;
  articleBox.innerHTML = `<a href="/courses/">← 返回教程</a><small>${escapeHtml(article.category)}</small><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.excerpt)}</p><div>${article.body_html}</div>`;
  articleBox.hidden = false;
  document.querySelector(".member-library").hidden = true;
}

async function loadSession() {
  try {
    const response = await fetch("/members/api/session", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "无法读取会员权限");
    activeMemberEmail = data.email;
    startHeartbeat();
    document.getElementById("memberGreeting").textContent = `${data.email} · 欢迎回来`;
    document.getElementById("memberSignout").hidden = false;
    loginBox.hidden = true;
    if (!data.member) {
      statusBox.innerHTML = "<small>当前状态</small><strong>未开通</strong><span>请联系管理员登记邮箱</span>";
      showNotice("这个邮箱已经完成身份验证，但还没有会员权限。请向管理员提供该邮箱开通。", "warning");
    } else if (!data.member.allowed) {
      statusBox.innerHTML = `<small>当前状态</small><strong>${data.member.expired ? "已到期" : "已暂停"}</strong><span>请联系管理员续期</span>`;
      showNotice(data.member.expired ? "会员权限已经到期，请续期后继续观看。" : "会员权限目前处于暂停状态。", "warning");
    } else {
      const expiry = data.member.expires_at ? data.member.expires_at.slice(0, 10) : "长期有效";
      statusBox.innerHTML = `<small>当前状态</small><strong>${levelLabel(data.member.tier)}</strong><span>有效期：${escapeHtml(expiry)}</span>`;
    }
    renderCourses(data.courses || []);
    const article = new URLSearchParams(location.search).get("article");
    if (article) loadArticle(article);
  } catch (error) {
    statusBox.innerHTML = "<small>当前状态</small><strong>等待登录</strong><span>请使用 Google 邮箱验证</span>";
    document.getElementById("memberGreeting").textContent = "使用登记的 Google 邮箱登录后，自动核对会员等级和有效期";
    loginBox.hidden = false;
    document.querySelector(".member-library").hidden = true;
    initializeGoogleLogin();
  }
}

grid.addEventListener("click", async (event) => {
  const progressButton = event.target.closest("button[data-progress]");
  if (progressButton && !progressButton.disabled) {
    progressButton.disabled = true;
    try {
      const response = await fetch("/members/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId: progressButton.dataset.progress, completed: progressButton.dataset.completed !== "true" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "无法保存学习进度");
      await loadSession();
    } catch (error) { showNotice(error.message, "error"); progressButton.disabled = false; }
    return;
  }
  const button = event.target.closest("button[data-lesson]");
  if (!button || button.disabled) return;
  button.disabled = true;
  const old = button.querySelector("em").textContent;
  button.querySelector("em").textContent = "加载中";
  try {
    const response = await fetch(`/members/api/play?id=${encodeURIComponent(button.dataset.lesson)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "无法播放视频");
    document.getElementById("playerTitle").textContent = data.title;
    frame.src = data.iframeUrl;
    player.hidden = false;
    startWatermark();
    player.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; button.querySelector("em").textContent = old; }
});

document.getElementById("closePlayer").addEventListener("click", stopPlayback);
document.getElementById("memberSignout").addEventListener("click", async () => { clearInterval(heartbeatTimer); stopPlayback(); await fetch("/members/api/logout", { method: "POST" }); location.assign("/members/"); });
loadSession();
