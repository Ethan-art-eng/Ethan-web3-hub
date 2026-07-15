function escapeToolHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const essentialGrid = document.getElementById("essentialGrid");
const categoryGrid = document.getElementById("toolCategoryGrid");
const toolSearch = document.getElementById("toolSearch");
const toolSearchClear = document.getElementById("toolSearchClear");
const toolCategoryFilters = document.getElementById("toolCategoryFilters");
const toolSpotlight = document.getElementById("toolSpotlight");
const toolSpotlightLink = document.getElementById("toolSpotlightLink");
const toolSpotlightName = document.getElementById("toolSpotlightName");
const toolSpotlightDescription = document.getElementById("toolSpotlightDescription");
let toolboxData = null;
let spotlightItems = [];
let spotlightIndex = 0;
let spotlightTimer = null;
let activeToolGroup = "all";

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

function filterToolGroups(groups, query) {
  const keyword = normalizeToolText(query);
  return groups
    .map((group, index) => {
      const items = Array.isArray(group.items) ? group.items : [];
      const groupMatches = normalizeToolText(`${group.label} ${group.title}`).includes(keyword);
      const visibleItems = !keyword || groupMatches
        ? items
        : items.filter((item) => normalizeToolText(`${item.name} ${item.description}`).includes(keyword));
      return { ...group, key: String(index), items: visibleItems };
    })
    .filter((group) => (activeToolGroup === "all" || group.key === activeToolGroup) && group.items.length > 0);
}

function renderCategoryFilters(groups) {
  if (!toolCategoryFilters) return;
  if (activeToolGroup !== "all" && !groups[Number(activeToolGroup)]) activeToolGroup = "all";
  toolCategoryFilters.innerHTML = [
    `<button class="${activeToolGroup === "all" ? "active" : ""}" type="button" data-tool-group="all" aria-pressed="${activeToolGroup === "all"}">全部工具</button>`,
    ...groups.map((group, index) => `<button class="${activeToolGroup === String(index) ? "active" : ""}" type="button" data-tool-group="${index}" aria-pressed="${activeToolGroup === String(index)}">${escapeToolHtml(group.title)}</button>`),
  ].join("");
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
    <section class="tool-category">
      <header><div><span>${escapeToolHtml(group.label)}</span><h3>${escapeToolHtml(group.title)}</h3></div><b>${group.items.length}</b></header>
      <div class="tool-list">${group.items.map((item) => item.url
        ? `<a href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${escapeToolHtml(item.name)}"><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small><b aria-hidden="true">↗</b></a>`
        : `<div class="tool-static"><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small></div>`).join("")}</div>
    </section>`).join("");
  updateSearchControls(query);
}

function readStaticToolGroups() {
  return Array.from(categoryGrid.querySelectorAll(".tool-category")).map((group) => ({
    label: group.querySelector("header span")?.textContent?.trim() || "工具",
    title: group.querySelector("header h3")?.textContent?.trim() || "工具分类",
    items: Array.from(group.querySelectorAll(".tool-list > *")).map((item) => ({
      name: item.querySelector("strong")?.textContent?.trim() || "工具入口",
      description: item.querySelector("small")?.textContent?.trim() || "打开工具",
      url: item.matches("a") ? item.href : "",
    })),
  }));
}

function applyToolSearch() {
  const query = toolSearch.value.trim();
  if (toolboxData) renderToolGroups(toolboxData.toolGroups, query);
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
  renderCategoryFilters(data.toolGroups);
  setSpotlightFromGroups(data.toolGroups);
  renderToolGroups(data.toolGroups, toolSearch.value.trim());
}

toolSearch.addEventListener("input", applyToolSearch);
toolSearchClear.addEventListener("click", () => {
  toolSearch.value = "";
  toolSearch.focus();
  applyToolSearch();
});

toolCategoryFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tool-group]");
  if (!button || !toolboxData) return;
  activeToolGroup = button.dataset.toolGroup || "all";
  renderCategoryFilters(toolboxData.toolGroups);
  renderToolGroups(toolboxData.toolGroups, toolSearch.value.trim());
});

const toolUrlQuery = new URLSearchParams(window.location.search).get("q") || "";
toolSearch.value = toolUrlQuery;
const staticToolGroups = readStaticToolGroups();
toolboxData = { toolGroups: staticToolGroups };
renderCategoryFilters(staticToolGroups);
setSpotlightFromGroups(staticToolGroups);
renderToolGroups(staticToolGroups, toolUrlQuery);

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
