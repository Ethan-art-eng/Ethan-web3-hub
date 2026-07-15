function escapeToolHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const essentialGrid = document.getElementById("essentialGrid");
const categoryGrid = document.getElementById("toolCategoryGrid");
const toolSearch = document.getElementById("toolSearch");
const toolSearchClear = document.getElementById("toolSearchClear");
const toolSpotlight = document.getElementById("toolSpotlight");
const toolSpotlightLink = document.getElementById("toolSpotlightLink");
const toolSpotlightName = document.getElementById("toolSpotlightName");
const toolSpotlightDescription = document.getElementById("toolSpotlightDescription");
let toolboxData = null;
let spotlightItems = [];
let spotlightIndex = 0;
let spotlightTimer = null;

const spotlightPriority = ["GMGN 网页版", "RootData", "DefiLlama", "Revoke.cash", "Orbiter", "Galxe", "Arkham"];

function normalizeToolText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function updateSearchControls(query) {
  toolSearchClear.hidden = !query;
}

function renderSpotlight(animate = true) {
  const item = spotlightItems[spotlightIndex];
  if (!item) return;
  toolSpotlightLink.href = item.url;
  toolSpotlightName.textContent = item.name;
  toolSpotlightDescription.textContent = item.description;
  toolSpotlightLink.setAttribute("aria-label", `打开 ${item.name}`);
  if (animate) {
    toolSpotlightLink.classList.remove("is-rotating");
    void toolSpotlightLink.offsetWidth;
    toolSpotlightLink.classList.add("is-rotating");
  }
}

function stopSpotlight() {
  if (spotlightTimer) window.clearInterval(spotlightTimer);
  spotlightTimer = null;
}

function startSpotlight() {
  stopSpotlight();
  if (spotlightItems.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  spotlightTimer = window.setInterval(() => {
    spotlightIndex = (spotlightIndex + 1) % spotlightItems.length;
    renderSpotlight();
  }, 3200);
}

function setSpotlightItems(items) {
  const linkItems = items.filter((item) => item.url);
  const byName = new Map(linkItems.map((item) => [item.name, item]));
  const prioritized = spotlightPriority.map((name) => byName.get(name)).filter(Boolean);
  const remaining = linkItems.filter((item) => !spotlightPriority.includes(item.name));
  spotlightItems = [...prioritized, ...remaining].slice(0, 10);
  spotlightIndex = 0;
  renderSpotlight(false);
  startSpotlight();
}

function setSpotlightFromGroups(groups) {
  const items = (Array.isArray(groups) ? groups : []).flatMap((group) => Array.isArray(group.items) ? group.items : []);
  setSpotlightItems(items);
}

function setSpotlightFromStaticMarkup() {
  const items = Array.from(categoryGrid.querySelectorAll(".tool-list a")).map((link) => ({
    name: link.querySelector("strong")?.textContent?.trim() || "工具入口",
    description: link.querySelector("small")?.textContent?.trim() || "打开工具",
    url: link.href,
  }));
  setSpotlightItems(items);
}

function filterToolGroups(groups, query) {
  const keyword = normalizeToolText(query);
  return groups
    .map((group) => {
      const items = Array.isArray(group.items) ? group.items : [];
      const groupMatches = normalizeToolText(`${group.label} ${group.title}`).includes(keyword);
      const visibleItems = !keyword || groupMatches
        ? items
        : items.filter((item) => normalizeToolText(`${item.name} ${item.description}`).includes(keyword));
      return { ...group, items: visibleItems };
    })
    .filter((group) => group.items.length > 0);
}

function renderToolGroups(groups, query = "") {
  const sourceGroups = Array.isArray(groups) ? groups : [];
  const visibleGroups = filterToolGroups(sourceGroups, query);

  if (!visibleGroups.length) {
    categoryGrid.innerHTML = `<div class="tool-search-empty"><strong>没有找到相关工具</strong><span>试试搜索“钱包”“空投”“跨链”或具体工具名称。</span></div>`;
    updateSearchControls(query);
    return;
  }

  categoryGrid.innerHTML = visibleGroups.map((group) => `
    <article class="tool-category">
      <header><span>${escapeToolHtml(group.label)}</span><h3>${escapeToolHtml(group.title)}</h3></header>
      <div class="tool-list">${group.items.map((item) => item.url
        ? `<a href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${escapeToolHtml(item.name)}"><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small></a>`
        : `<div class="tool-static"><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small></div>`).join("")}</div>
    </article>`).join("");
  updateSearchControls(query);
}

function filterStaticToolGroups(query) {
  const keyword = normalizeToolText(query);
  const groups = Array.from(categoryGrid.querySelectorAll(".tool-category"));

  groups.forEach((group) => {
    const heading = group.querySelector("header")?.textContent || "";
    const groupMatches = normalizeToolText(heading).includes(keyword);
    const items = Array.from(group.querySelectorAll(".tool-list > *"));
    let groupVisible = 0;

    items.forEach((item) => {
      const matches = !keyword || groupMatches || normalizeToolText(item.textContent).includes(keyword);
      item.hidden = !matches;
      if (matches) groupVisible += 1;
    });

    group.hidden = groupVisible === 0;
  });

  updateSearchControls(query);
}

function applyToolSearch() {
  const query = toolSearch.value.trim();
  if (toolboxData) renderToolGroups(toolboxData.toolGroups, query);
  else filterStaticToolGroups(query);
}

function renderToolbox(data) {
  toolboxData = data;
  essentialGrid.innerHTML = data.essentials.map((item) => `
    <article class="essential-card">
      <span>${escapeToolHtml(item.type || "入口")}</span>
      <h3>${escapeToolHtml(item.name)}</h3>
      <p>${escapeToolHtml(item.description)}</p>
      ${item.code ? `<dl><dt>邀请码</dt><dd>${escapeToolHtml(item.code)}</dd></dl>` : ""}
      ${item.url ? `<a class="tool-action" href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer">链接直达</a>` : ""}
    </article>`).join("");
  setSpotlightFromGroups(data.toolGroups);
  renderToolGroups(data.toolGroups, toolSearch.value.trim());
}

toolSearch.addEventListener("input", applyToolSearch);
toolSearchClear.addEventListener("click", () => {
  toolSearch.value = "";
  toolSearch.focus();
  applyToolSearch();
});

const toolUrlQuery = new URLSearchParams(window.location.search).get("q") || "";
toolSearch.value = toolUrlQuery;
filterStaticToolGroups(toolUrlQuery);
setSpotlightFromStaticMarkup();

toolSpotlight.addEventListener("mouseenter", stopSpotlight);
toolSpotlight.addEventListener("mouseleave", startSpotlight);
toolSpotlight.addEventListener("focusin", stopSpotlight);
toolSpotlight.addEventListener("focusout", startSpotlight);

fetch("../api/site-content", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(renderToolbox)
  .catch((error) => console.warn("工具箱动态数据暂时不可用，已保留页面备用内容。", error));
