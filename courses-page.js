function escapeCourseHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const tutorialPaths = {
  "tutorial-01": "./wallet-security/",
  "tutorial-02": "./onchain-basics/",
  "tutorial-03": "./defi-basics/",
  "tutorial-04": "./project-research/",
};

fetch("../api/site-content", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    document.getElementById("learningPath").innerHTML = data.tutorials.map((item) => `
      <article>
        <span>${escapeCourseHtml(item.stage)}</span>
        <h3>${escapeCourseHtml(item.title)}</h3>
        <p>${escapeCourseHtml(item.description)}</p>
        <em>${escapeCourseHtml(item.audience)}</em>
        <a class="tutorial-detail-link" href="${escapeCourseHtml(item.url || tutorialPaths[item.id] || "./")}">查看教程</a>
      </article>`).join("");
  })
  .catch((error) => console.warn("教程动态数据暂时不可用，已保留页面备用内容。", error));
