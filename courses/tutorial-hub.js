const tutorialSearchForm = document.getElementById("tutorialSearch");
const tutorialSearchInput = document.getElementById("tutorialSearchInput");
const tutorialTopics = document.getElementById("tutorialTopics");
const tutorialRows = Array.from(document.querySelectorAll(".tutorial-article-row"));
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
