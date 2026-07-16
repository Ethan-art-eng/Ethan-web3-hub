function escapeCourseHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const tutorialPaths = {
  "tutorial-01": "./wallet-security/",
  "tutorial-02": "./onchain-basics/",
  "tutorial-03": "./defi-basics/",
  "tutorial-04": "./project-research/",
};
const tutorialLabels = ["基础安全", "链上操作", "DeFi 应用", "研究判断"];
const progressStorageKey = "ethan-course-progress-v1";
const learningPath = document.getElementById("learningPath");
const progressText = document.getElementById("courseProgressText");
const progressBar = document.getElementById("courseProgressBar");
const progressTrack = progressBar?.closest("[role='progressbar']");
const progressReset = document.getElementById("courseProgressReset");

function readCourseProgress() {
  try {
    const value = JSON.parse(window.localStorage.getItem(progressStorageKey) || "[]");
    return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function writeCourseProgress(progress) {
  try {
    window.localStorage.setItem(progressStorageKey, JSON.stringify(Array.from(progress)));
  } catch (error) {
    console.warn("无法保存教程进度。", error);
  }
}

function updateCourseProgress() {
  const rows = Array.from(learningPath.querySelectorAll("[data-course-id]"));
  const progress = readCourseProgress();
  const completed = rows.filter((row) => progress.has(row.dataset.courseId)).length;
  const total = rows.length || 4;
  const percentage = Math.round((completed / total) * 100);

  progressText.textContent = `${completed} / ${total}`;
  progressBar.style.width = `${percentage}%`;
  progressTrack?.setAttribute("aria-valuemax", String(total));
  progressTrack?.setAttribute("aria-valuenow", String(completed));
  progressReset.hidden = completed === 0;

  rows.forEach((row) => {
    const isComplete = progress.has(row.dataset.courseId);
    row.classList.toggle("is-complete", isComplete);
    const button = row.querySelector(".course-complete-toggle");
    if (!button) return;
    button.setAttribute("aria-pressed", String(isComplete));
    button.textContent = isComplete ? "已完成" : "标记完成";
  });
}

function renderTutorials(items) {
  learningPath.innerHTML = items.map((item, index) => `
    <article class="course-row" data-course-id="${escapeCourseHtml(item.id || `tutorial-${index + 1}`)}">
      <span class="course-step">${escapeCourseHtml(item.stage || String(index + 1).padStart(2, "0"))}</span>
      <div class="course-copy">
        <small>${escapeCourseHtml(tutorialLabels[index] || "教程")}</small>
        <h3>${escapeCourseHtml(item.title)}</h3>
        <p>${escapeCourseHtml(item.description)}</p>
      </div>
      <em>${escapeCourseHtml(item.audience)}</em>
      <a class="course-open" href="${escapeCourseHtml(item.url || tutorialPaths[item.id] || "./")}">开始学习 <i aria-hidden="true">→</i></a>
      <button class="course-complete-toggle" type="button" aria-pressed="false">标记完成</button>
    </article>`).join("");
  updateCourseProgress();
}

learningPath.addEventListener("click", (event) => {
  const button = event.target.closest(".course-complete-toggle");
  if (!button) return;
  const row = button.closest("[data-course-id]");
  const progress = readCourseProgress();
  if (progress.has(row.dataset.courseId)) progress.delete(row.dataset.courseId);
  else progress.add(row.dataset.courseId);
  writeCourseProgress(progress);
  updateCourseProgress();
});

progressReset.addEventListener("click", () => {
  writeCourseProgress(new Set());
  updateCourseProgress();
});

updateCourseProgress();

fetch("../api/site-content", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    if (Array.isArray(data.tutorials) && data.tutorials.length) renderTutorials(data.tutorials);
  })
  .catch((error) => console.warn("教程动态数据暂时不可用，已保留页面备用内容。", error));
