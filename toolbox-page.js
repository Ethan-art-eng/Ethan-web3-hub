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
const toolResultTitle = document.getElementById("toolResultTitle");
const toolResultCount = document.getElementById("toolResultCount");
const toolPagination = document.getElementById("toolPagination");
const toolPagePrevious = document.getElementById("toolPagePrevious");
const toolPageNext = document.getElementById("toolPageNext");
const toolPageStatus = document.getElementById("toolPageStatus");
let toolboxData = null;
let spotlightItems = [];
let spotlightIndex = 0;
let spotlightTimer = null;
let activeToolGroup = "all";
let currentToolPage = 1;
const recentToolsStorageKey = "ethan-toolbox-recent";
const toolsPerPage = 10;

const spotlightPriority = ["GMGN 网页版", "RootData", "DefiLlama", "Revoke.cash", "Orbiter", "Galxe", "Arkham"];

function normalizeToolText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function updateSearchControls(query) {
  toolSearchClear.hidden = !query;
}

function getEssentialLogo(name) {
  const normalizedName = normalizeToolText(name);
  if (normalizedName.includes("币安") || normalizedName.includes("binance")) return "../assets/exchanges/binance.svg";
  if (normalizedName.includes("欧易") || normalizedName.includes("okx")) return "../assets/exchanges/okx.svg";
  return "../favicon.svg";
}

function readRecentTools() {
  try {
    const items = JSON.parse(window.localStorage.getItem(recentToolsStorageKey) || "[]");
    return Array.isArray(items) ? items.filter((item) => item && item.name && item.url).slice(0, 6) : [];
  } catch (error) {
    return [];
  }
}

function saveRecentTool(item) {
  if (!item?.name || !item?.url) return;
  const recentItems = readRecentTools().filter((recentItem) => recentItem.url !== item.url);
  recentItems.unshift(item);
  try {
    window.localStorage.setItem(recentToolsStorageKey, JSON.stringify(recentItems.slice(0, 6)));
  } catch (error) {
    console.warn("无法保存最近使用的工具。", error);
  }
}

async function copyToolCode(button) {
  const code = button.dataset.copyCode || "";
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = code;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  const originalLabel = button.textContent;
  button.textContent = "已复制";
  button.classList.add("is-copied");
  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("is-copied");
  }, 1400);
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
  const sourceGroups = activeToolGroup === "recent"
    ? [{ label: "快捷入口", title: "最近使用", items: readRecentTools() }]
    : groups;
  return sourceGroups
    .map((group, index) => {
      const items = Array.isArray(group.items) ? group.items : [];
      const groupLabel = normalizeToolText(group.label);
      const groupTitle = normalizeToolText(group.title);
      const groupMatches = groupLabel === keyword || groupTitle === keyword || groupTitle.startsWith(keyword);
      const visibleItems = !keyword || groupMatches
        ? items
        : items.filter((item) => normalizeToolText(`${item.name} ${item.description}`).includes(keyword));
      return {
        ...group,
        key: String(index),
        items: visibleItems.map((item) => ({
          ...item,
          groupLabel: item.groupLabel || group.label,
          groupTitle: item.groupTitle || group.title,
        })),
      };
    })
    .filter((group) => (activeToolGroup === "all" || activeToolGroup === "recent" || group.key === activeToolGroup) && group.items.length > 0);
}

function renderCategoryFilters(groups) {
  if (!toolCategoryFilters) return;
  const recentTools = readRecentTools();
  if (activeToolGroup === "recent" && !recentTools.length) activeToolGroup = "all";
  if (activeToolGroup !== "all" && activeToolGroup !== "recent" && !groups[Number(activeToolGroup)]) activeToolGroup = "all";
  toolCategoryFilters.innerHTML = [
    `<button class="${activeToolGroup === "all" ? "active" : ""}" type="button" data-tool-group="all" aria-pressed="${activeToolGroup === "all"}">全部工具</button>`,
    recentTools.length ? `<button class="${activeToolGroup === "recent" ? "active" : ""}" type="button" data-tool-group="recent" aria-pressed="${activeToolGroup === "recent"}">最近使用</button>` : "",
    ...groups.map((group, index) => `<button class="${activeToolGroup === String(index) ? "active" : ""}" type="button" data-tool-group="${index}" aria-pressed="${activeToolGroup === String(index)}">${escapeToolHtml(group.title)}</button>`),
  ].join("");
}

function getToolResultTitle(groups, query) {
  if (query) return `搜索“${query}”`;
  if (activeToolGroup === "recent") return "最近使用";
  if (activeToolGroup === "all") return "全部工具";
  return groups[Number(activeToolGroup)]?.title || "工具目录";
}

function renderToolGroups(groups, query = "") {
  const sourceGroups = Array.isArray(groups) ? groups : [];
  const visibleGroups = filterToolGroups(sourceGroups, query);
  const visibleItems = visibleGroups.flatMap((group) => group.items);
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / toolsPerPage));
  currentToolPage = Math.min(Math.max(currentToolPage, 1), totalPages);
  const pageStart = (currentToolPage - 1) * toolsPerPage;
  const pageItems = visibleItems.slice(pageStart, pageStart + toolsPerPage);

  toolResultTitle.textContent = getToolResultTitle(sourceGroups, query);
  toolResultCount.textContent = `共 ${visibleItems.length} 个工具`;
  toolPagination.hidden = visibleItems.length <= toolsPerPage;
  toolPagePrevious.disabled = currentToolPage <= 1;
  toolPageNext.disabled = currentToolPage >= totalPages;
  toolPageStatus.textContent = `第 ${currentToolPage} / ${totalPages} 页`;

  if (!visibleItems.length) {
    categoryGrid.innerHTML = `<div class="tool-search-empty"><strong>没有找到相关工具</strong><span>试试搜索“钱包”“空投”“跨链”或具体工具名称。</span></div>`;
    updateSearchControls(query);
    return;
  }

  categoryGrid.innerHTML = `<div class="tool-list tool-directory-list">${pageItems.map((item) => item.url
    ? `<a href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="打开 ${escapeToolHtml(item.name)}" data-tool-name="${escapeToolHtml(item.name)}" data-tool-description="${escapeToolHtml(item.description)}" data-tool-group-label="${escapeToolHtml(item.groupLabel)}" data-tool-group-title="${escapeToolHtml(item.groupTitle)}"><span class="tool-row-category">${escapeToolHtml(item.groupTitle)}</span><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small><b aria-hidden="true">↗</b></a>`
    : `<div class="tool-static"><span class="tool-row-category">${escapeToolHtml(item.groupTitle)}</span><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small></div>`).join("")}</div>`;
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
  currentToolPage = 1;
  if (!toolboxData) return;
  if (query && activeToolGroup !== "all") {
    activeToolGroup = "all";
    renderCategoryFilters(toolboxData.toolGroups);
  }
  renderToolGroups(toolboxData.toolGroups, query);
}

function renderToolbox(data) {
  toolboxData = data;
  essentialGrid.innerHTML = data.essentials.map((item) => `
    <article class="essential-card">
      <div class="essential-card-top"><img src="${getEssentialLogo(item.name)}" alt="" /><span>${escapeToolHtml(item.type || "入口")}</span></div>
      <h3>${escapeToolHtml(item.name)}</h3>
      ${item.code ? `<div class="essential-code"><span>邀请码</span><strong>${escapeToolHtml(item.code)}</strong><button type="button" data-copy-code="${escapeToolHtml(item.code)}">复制</button></div>` : ""}
      ${item.url ? `<a class="tool-action" href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer"><span>链接直达</span><b aria-hidden="true">↗</b></a>` : ""}
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

essentialGrid.addEventListener("click", (event) => {
  const copyButton = event.target.closest("button[data-copy-code]");
  if (copyButton) copyToolCode(copyButton);
});

categoryGrid.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-tool-name]");
  if (!link || !toolboxData) return;
  saveRecentTool({
    name: link.dataset.toolName,
    description: link.dataset.toolDescription || "工具入口",
    url: link.href,
    groupLabel: link.dataset.toolGroupLabel || "工具",
    groupTitle: link.dataset.toolGroupTitle || "最近使用",
  });
  renderCategoryFilters(toolboxData.toolGroups);
});

toolCategoryFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tool-group]");
  if (!button || !toolboxData) return;
  activeToolGroup = button.dataset.toolGroup || "all";
  currentToolPage = 1;
  renderCategoryFilters(toolboxData.toolGroups);
  renderToolGroups(toolboxData.toolGroups, toolSearch.value.trim());
});

toolPagination.addEventListener("click", (event) => {
  if (!toolboxData) return;
  if (event.target.closest("#toolPagePrevious") && !toolPagePrevious.disabled) currentToolPage -= 1;
  else if (event.target.closest("#toolPageNext") && !toolPageNext.disabled) currentToolPage += 1;
  else return;
  renderToolGroups(toolboxData.toolGroups, toolSearch.value.trim());
  document.querySelector(".tool-results-heading")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
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
