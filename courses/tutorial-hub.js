const tutorialSearchForm = document.getElementById("tutorialSearch");
const tutorialSearchInput = document.getElementById("tutorialSearchInput");
const tutorialTopics = document.getElementById("tutorialTopics");
let tutorialRows = Array.from(document.querySelectorAll(".tutorial-article-row"));
const tutorialFeature = document.querySelector(".tutorial-feature");
const tutorialEmpty = document.getElementById("tutorialEmpty");
const tutorialToast = document.getElementById("tutorialToast");
const tutorialResultCount = document.getElementById("tutorialResultCount");
const tutorialClearFilters = document.getElementById("tutorialClearFilters");
let activeTopic = "全部主题";
let toastTimer;

function normalizeTutorialText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function applyTutorialFilters() {
  const query = normalizeTutorialText(tutorialSearchInput.value);
  let visibleRows = 0;

  tutorialRows.forEach((row) => {
    const matchesTopic = activeTopic === "全部主题" || row.dataset.topic === activeTopic;
    const matchesQuery = !query || normalizeTutorialText(`${row.dataset.search} ${row.textContent}`).includes(query);
    const visible = matchesTopic && matchesQuery;
    row.hidden = !visible;
    if (visible) visibleRows += 1;
  });

  const featureMatchesTopic = activeTopic === "全部主题" || tutorialFeature.dataset.topic === activeTopic;
  const featureMatchesQuery = !query || normalizeTutorialText(`${tutorialFeature.dataset.search} ${tutorialFeature.textContent}`).includes(query);
  tutorialFeature.hidden = !(featureMatchesTopic && featureMatchesQuery);
  tutorialEmpty.hidden = visibleRows > 0;
  tutorialResultCount.textContent = `共 ${visibleRows} 篇内容`;
  tutorialClearFilters.hidden = activeTopic === "全部主题" && !query;
}

function showTutorialNotice(message) {
  window.clearTimeout(toastTimer);
  tutorialToast.textContent = message;
  tutorialToast.hidden = false;
  toastTimer = window.setTimeout(() => {
    tutorialToast.hidden = true;
  }, 3200);
}

tutorialSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyTutorialFilters();
});

tutorialSearchInput.addEventListener("input", applyTutorialFilters);

tutorialTopics.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-topic]");
  if (!button) return;
  activeTopic = button.dataset.topic;
  tutorialTopics.querySelectorAll("button").forEach((item) => {
    const active = item === button;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  applyTutorialFilters();
});

tutorialClearFilters.addEventListener("click", () => {
  activeTopic = "全部主题";
  tutorialSearchInput.value = "";
  tutorialTopics.querySelectorAll("button").forEach((item) => {
    const active = item.dataset.topic === activeTopic;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  applyTutorialFilters();
});

document.querySelectorAll(".tutorial-mode").forEach((mode) => mode.addEventListener("click", () => {
  document.querySelectorAll(".tutorial-mode").forEach((item) => item.classList.toggle("is-active", item === mode));
}));

document.addEventListener("click", (event) => {
  const noticeButton = event.target.closest("[data-notice]");
  if (noticeButton) showTutorialNotice(noticeButton.dataset.notice);

});

function renderLocalProgress() {
  let completed = [];
  try {
    const stored = JSON.parse(localStorage.getItem("ethan-course-progress-v1") || "[]");
    completed = Array.isArray(stored) ? stored : [];
  } catch {}
  const completedSet = new Set(completed);
  const allIds = new Set();
  document.querySelectorAll(".tutorial-path-card[data-path-ids]").forEach((card) => {
    const ids = card.dataset.pathIds.split(",").filter(Boolean);
    ids.forEach((id) => allIds.add(id));
    card.dataset.completed = String(ids.length > 0 && ids.every((id) => completedSet.has(id)));
  });
  const completeCount = Array.from(allIds).filter((id) => completedSet.has(id)).length;
  const total = allIds.size;
  const progress = document.getElementById("tutorialLocalProgress");
  progress.querySelector("strong").textContent = `已完成 ${completeCount} / ${total} 篇`;
  progress.querySelector("b").style.width = `${total ? Math.round(completeCount / total * 100) : 0}%`;
}

function escapeDynamicHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

fetch("../api/articles", { cache: "no-store" })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
  .then((data) => {
    const list = document.getElementById("tutorialArticleList");
    (data.articles || []).slice().reverse().forEach((article) => {
      if (Array.from(list.querySelectorAll("a")).some((link) => link.getAttribute("href") === `../articles/${article.slug}/`)) return;
      const link = document.createElement("a");
      link.className = "tutorial-article-row";
      link.href = `../articles/${encodeURIComponent(article.slug)}/`;
      link.dataset.topic = article.category || "投资基础";
      link.dataset.search = `${article.title} ${article.excerpt} ${article.category}`;
      const cover = article.cover_url ? `<span class="tutorial-cover tutorial-cover-image" style="background-image:url('${escapeDynamicHtml(article.cover_url)}')"></span>` : `<span class="tutorial-cover tutorial-cover-dark">NEW</span>`;
      link.innerHTML = `${cover}<span class="tutorial-article-copy"><strong>${escapeDynamicHtml(article.title)}</strong><small>${escapeDynamicHtml(article.excerpt)}</small><em>${escapeDynamicHtml(article.category)} · 最新发布</em></span><span class="tutorial-free-tag">免费阅读</span><span class="tutorial-duration">${Number(article.reading_minutes) || 5} 分钟</span><span class="tutorial-row-arrow" aria-hidden="true">→</span>`;
      list.prepend(link);
    });
    tutorialRows = Array.from(document.querySelectorAll(".tutorial-article-row"));
    const courses = data.courses || [];
    if (courses.length) {
      const featured = courses[0];
      document.getElementById("featuredCourseTitle").textContent = featured.title;
      document.getElementById("featuredCourseDescription").textContent = featured.description;
      document.getElementById("featuredCourseStats").classList.remove("is-empty");
      document.getElementById("featuredCourseStats").innerHTML = `<span><strong>${featured.lesson_count || 0}</strong><small>视频课时</small></span><span><strong>${featured.duration_minutes || 0}</strong><small>分钟</small></span><span><strong>${featured.access_level === "premium" ? "高级" : featured.access_level === "free" ? "免费" : "会员"}</strong><small>观看权限</small></span>`;
      const moreCourses = courses.slice(1);
      document.getElementById("dynamicCourseList").innerHTML = moreCourses.length ? moreCourses.map((course, index) => `<a href="../members/"><article><span class="tutorial-course-icon${index % 2 ? " is-green" : ""}">${String(index + 2).padStart(2, "0")}</span><span><strong>${escapeDynamicHtml(course.title)}</strong><small>${course.lesson_count || 0} 节 · ${course.duration_minutes || 0} 分钟 · ${course.access_level === "premium" ? "高级会员" : course.access_level === "free" ? "免费" : "会员学习区"}</small></span><em>查看</em></article></a>`).join("") : '<p class="tutorial-course-empty">当前仅发布了上方一门课程。</p>';
    }
    applyTutorialFilters();
  })
  .catch((error) => console.warn("动态文章和课程暂时不可用。", error));

tutorialTopics.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.classList.contains("is-active"))));
renderLocalProgress();
applyTutorialFilters();
