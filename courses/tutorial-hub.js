const tutorialSearchForm = document.getElementById("tutorialSearch");
const tutorialSearchInput = document.getElementById("tutorialSearchInput");
const tutorialTopics = document.getElementById("tutorialTopics");
let tutorialRows = Array.from(document.querySelectorAll(".tutorial-article-row"));
const tutorialFeature = document.querySelector(".tutorial-feature");
const tutorialEmpty = document.getElementById("tutorialEmpty");
const tutorialToast = document.getElementById("tutorialToast");
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
  tutorialTopics.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
  applyTutorialFilters();
});

document.addEventListener("click", (event) => {
  const noticeButton = event.target.closest("[data-notice]");
  if (noticeButton) showTutorialNotice(noticeButton.dataset.notice);

  const tabButton = event.target.closest(".tutorial-article-tabs button");
  if (tabButton) {
    tabButton.parentElement.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === tabButton));
    if (!tabButton.matches(":first-child")) showTutorialNotice("该内容视图正在整理，目前先展示最新图文教程。");
  }
});

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
      document.getElementById("featuredCourseStats").innerHTML = `<span><strong>${featured.lesson_count || 0}</strong><small>视频课时</small></span><span><strong>${featured.duration_minutes || 0}</strong><small>分钟</small></span><span><strong>${featured.access_level === "premium" ? "高级" : featured.access_level === "free" ? "免费" : "会员"}</strong><small>观看权限</small></span>`;
      document.getElementById("dynamicCourseList").innerHTML = courses.slice(1).map((course, index) => `<article><span class="tutorial-course-icon${index % 2 ? " is-green" : ""}">${String(index + 2).padStart(2, "0")}</span><span><strong>${escapeDynamicHtml(course.title)}</strong><small>${course.lesson_count || 0} 节 · ${course.duration_minutes || 0} 分钟 · ${course.access_level === "premium" ? "高级会员" : course.access_level === "free" ? "免费" : "会员专享"}</small></span><em>${course.access_level === "free" ? "可观看" : "需权限"}</em></article>`).join("");
    }
    applyTutorialFilters();
  })
  .catch((error) => console.warn("动态文章和课程暂时不可用。", error));
