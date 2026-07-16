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

fetch("../api/site-content", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    document.getElementById("learningPath").innerHTML = data.tutorials.map((item, index) => `
      <article>
        <a class="course-row" href="${escapeCourseHtml(item.url || tutorialPaths[item.id] || "./")}">
          <span class="course-step">${escapeCourseHtml(item.stage)}</span>
          <div class="course-copy">
            <small>${escapeCourseHtml(tutorialLabels[index] || "教程")}</small>
            <h3>${escapeCourseHtml(item.title)}</h3>
            <p>${escapeCourseHtml(item.description)}</p>
          </div>
          <em>${escapeCourseHtml(item.audience)}</em>
          <b>开始学习 <i aria-hidden="true">→</i></b>
        </a>
      </article>`).join("");
  })
  .catch((error) => console.warn("教程动态数据暂时不可用，已保留页面备用内容。", error));
