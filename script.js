const { projects, airdrops, courses, tutorials } = window.web3Content;
let activeCategory = "全部";

function renderProjectFilters() {
  const filters = ["全部", ...new Set(projects.map((project) => project.category))];
  document.getElementById("projectFilters").innerHTML = filters
    .map(
      (filter) => `
        <button class="${filter === activeCategory ? "selected" : ""}" type="button" data-category="${filter}">
          ${filter}
        </button>
      `
    )
    .join("");
}

function renderProjects(items) {
  document.getElementById("projectGrid").innerHTML = items
    .map(
      (project) => `
        <article class="project-card">
          <div class="card-top">
            <span>${project.category}</span>
            <em class="risk-${project.risk === "高" ? "high" : project.risk === "中高" ? "mid" : "low"}">
              ${project.risk}风险
            </em>
          </div>
          <h3>${project.name}</h3>
          <p>${project.summary}</p>
          <div class="project-meta">
            <strong>${project.chain}</strong>
            <small>${project.status}</small>
          </div>
          <div class="tag-row">
            ${project.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderAirdrops() {
  document.getElementById("airdropBoard").innerHTML = airdrops
    .map(
      (item) => `
        <article class="airdrop-card">
          <div>
            <span>${item.cost}</span>
            <h3>${item.name}</h3>
            <p>${item.note}</p>
          </div>
          <div class="progress" aria-label="${item.name} 进度 ${item.progress}%">
            <i style="width: ${item.progress}%"></i>
          </div>
          <strong>${item.progress}%</strong>
        </article>
      `
    )
    .join("");
}

function renderCourses() {
  document.getElementById("courseTimeline").innerHTML = courses
    .map(
      (course) => `
        <article class="course-card">
          <span>${course.stage}</span>
          <h3>${course.title}</h3>
          <ul>
            ${course.lessons.map((lesson) => `<li>${lesson}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function renderTutorials() {
  document.getElementById("tutorialGrid").innerHTML = tutorials
    .map(
      (tutorial) => `
        <article class="tutorial-card">
          <span>${tutorial.type}</span>
          <h3>${tutorial.title}</h3>
          <p>${tutorial.summary}</p>
          <a href="${tutorial.href}">查看教程</a>
        </article>
      `
    )
    .join("");
}

function applyProjectFilters() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = projects.filter((project) => {
    const text = `${project.name}${project.category}${project.chain}${project.status}${project.risk}${project.summary}${project.tags.join("")}`.toLowerCase();
    return (activeCategory === "全部" || project.category === activeCategory) && text.includes(keyword);
  });
  renderProjects(filtered);
}

function bindProjectControls() {
  document.getElementById("searchInput").addEventListener("input", applyProjectFilters);
  document.getElementById("projectFilters").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderProjectFilters();
    applyProjectFilters();
  });
}

function drawNetwork() {
  const canvas = document.getElementById("networkCanvas");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width;
  const height = rect.height;
  const nodes = [
    { x: 0.5, y: 0.48, r: 58, label: "Research", color: "#ffffff" },
    { x: 0.22, y: 0.26, r: 34, label: "DeFi", color: "#7dd3fc" },
    { x: 0.78, y: 0.27, r: 36, label: "Airdrop", color: "#c4b5fd" },
    { x: 0.2, y: 0.72, r: 32, label: "Wallet", color: "#86efac" },
    { x: 0.78, y: 0.72, r: 34, label: "Course", color: "#fcd34d" },
    { x: 0.5, y: 0.84, r: 28, label: "Risk", color: "#fda4af" },
  ];

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width / 1.4);
  gradient.addColorStop(0, "#172554");
  gradient.addColorStop(1, "#020617");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 1;
  nodes.slice(1).forEach((node) => {
    ctx.beginPath();
    ctx.moveTo(nodes[0].x * width, nodes[0].y * height);
    ctx.lineTo(node.x * width, node.y * height);
    ctx.stroke();
  });

  nodes.forEach((node, index) => {
    const x = node.x * width;
    const y = node.y * height;
    ctx.beginPath();
    ctx.arc(x, y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? "#0052ff" : "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.strokeStyle = index === 0 ? "#60a5fa" : node.color;
    ctx.lineWidth = index === 0 ? 2 : 1.5;
    ctx.stroke();
    ctx.fillStyle = index === 0 ? "#ffffff" : node.color;
    ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, x, y);
  });
}

function init() {
  renderProjectFilters();
  renderProjects(projects);
  renderAirdrops();
  renderCourses();
  renderTutorials();
  bindProjectControls();
  drawNetwork();
}

window.addEventListener("resize", drawNetwork);
document.addEventListener("DOMContentLoaded", init);
