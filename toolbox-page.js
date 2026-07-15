function escapeToolHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const essentialGrid = document.getElementById("essentialGrid");
const categoryGrid = document.getElementById("toolCategoryGrid");
const toolSearch = document.getElementById("toolSearch");
const toolSearchClear = document.getElementById("toolSearchClear");
const toolSort = document.getElementById("toolSort");
const toolCategoryFilters = document.getElementById("toolCategoryFilters");
const toolSpotlight = document.getElementById("toolSpotlight");
const toolSpotlightLink = document.getElementById("toolSpotlightLink");
const toolSpotlightName = document.getElementById("toolSpotlightName");
const toolSpotlightDescription = document.getElementById("toolSpotlightDescription");
const toolResultTitle = document.getElementById("toolResultTitle");
const toolResultCount = document.getElementById("toolResultCount");
const toolDisplayStatus = document.getElementById("toolDisplayStatus");
const toolSidebarCount = document.getElementById("toolSidebarCount");
const toolLoadMore = document.getElementById("toolLoadMore");
const toolFeaturedGrid = document.getElementById("toolFeaturedGrid");
const toolCommonList = document.getElementById("toolCommonList");

let toolboxData = null;
let spotlightItems = [];
let spotlightIndex = 0;
let spotlightTimer = null;
let activeToolGroup = "all";
let visibleToolLimit = 8;

const toolBatchSize = 8;
const recentToolsStorageKey = "ethan-toolbox-recent";
const favoriteToolsStorageKey = "ethan-toolbox-favorites";
const toolLogoVersion = "20260715-v1";
const spotlightPriority = ["GMGN 网页版", "RootData", "DefiLlama", "Revoke.cash", "Orbiter", "Galxe", "Arkham"];
const commonToolPriority = ["GMGN 网页版", "RootData", "DefiLlama", "Revoke.cash", "Orbiter"];
const featuredToolPriority = ["GMGN 网页版", "RootData", "Revoke.cash"];
const featuredToolMeta = {
  "GMGN 网页版": { badge: "交易常用", summary: "追踪 Meme 市场与链上交易机会。" },
  RootData: { badge: "研究必备", summary: "查看项目融资、机构与团队信息。" },
  "Revoke.cash": { badge: "安全检查", summary: "检查并取消不再需要的代币授权。" },
};
const bundledToolLogoKeys = new Set([
  "5sim-net", "985proxy-com", "airdrops-io", "alphadrops-net", "arkm-com", "bubblemaps-io", "chain-fm", "chainstack-com",
  "cryptohunt-ai", "cryptoserve-org", "debank-com", "debot-ai", "defillama-com", "dropsearn-com", "earni-fi", "followin-io",
  "galxe-com", "gmgn-ai", "goerlifaucet-com", "inv02-fcweba-cc", "kookeey-com", "morelogin-com", "nxonearth-com", "orbiter-finance",
  "paradigm-xyz", "rabbithole-gg", "revoke-cash", "rootdata-com", "sms-bus-com", "uniswap-org", "web3serve-com",
]);
const unavailableToolLogoKeys = new Set(["pump-news", "addrproof-top"]);

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

function getToolLogoHost(item) {
  const normalizedName = normalizeToolText(item?.name);
  if (normalizedName === "gmgn bot") return "gmgn.ai";
  if (normalizedName === "arkham") return "arkm.com";
  if (normalizedName === "uniswap") return "uniswap.org";
  if (normalizedName === "paradigm faucet") return "paradigm.xyz";
  if (normalizedName === "chainstack faucet") return "chainstack.com";
  try {
    return new URL(item?.url || "").hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function getToolLogoSource(item) {
  const host = getToolLogoHost(item);
  if (!host) return null;
  const key = host.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  if (bundledToolLogoKeys.has(key)) return { src: `../assets/tools/${key}.png?v=${toolLogoVersion}`, stage: "local" };
  if (unavailableToolLogoKeys.has(key)) return null;
  return { src: `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(item?.url || "")}&sz=256`, stage: "remote" };
}

function getToolInitials(name) {
  const cleaned = String(name || "W3").replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => /^[a-z0-9]/i.test(word))) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return Array.from(words.join("") || "W3").slice(0, 2).join("").toUpperCase();
}

function renderToolLogo(item, className = "") {
  const logo = getToolLogoSource(item);
  const name = escapeToolHtml(item?.name || "工具");
  return `<span class="tool-logo ${className} ${logo ? "" : "is-fallback"}" data-tool-logo><span class="tool-logo-fallback" aria-hidden="true">${escapeToolHtml(getToolInitials(item?.name))}</span>${logo ? `<img src="${escapeToolHtml(logo.src)}" data-logo-stage="${logo.stage}" data-tool-url="${escapeToolHtml(item?.url || "")}" alt="" loading="lazy" />` : ""}<span class="sr-only">${name}</span></span>`;
}

function readRecentTools() {
  try {
    const items = JSON.parse(window.localStorage.getItem(recentToolsStorageKey) || "[]");
    return Array.isArray(items) ? items.filter((item) => item && item.name && item.url).slice(0, 12) : [];
  } catch (error) {
    return [];
  }
}

function saveRecentTool(item) {
  if (!item?.name || !item?.url) return;
  const recentItems = readRecentTools().filter((recentItem) => recentItem.url !== item.url);
  recentItems.unshift(item);
  try {
    window.localStorage.setItem(recentToolsStorageKey, JSON.stringify(recentItems.slice(0, 12)));
  } catch (error) {
    console.warn("无法保存最近使用的工具。", error);
  }
}

function readFavoriteTools() {
  try {
    const items = JSON.parse(window.localStorage.getItem(favoriteToolsStorageKey) || "[]");
    return new Set(Array.isArray(items) ? items.filter(Boolean) : []);
  } catch (error) {
    return new Set();
  }
}

function writeFavoriteTools(favorites) {
  try {
    window.localStorage.setItem(favoriteToolsStorageKey, JSON.stringify(Array.from(favorites)));
  } catch (error) {
    console.warn("无法保存收藏工具。", error);
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

function flattenToolGroups(groups) {
  return (Array.isArray(groups) ? groups : []).flatMap((group, groupIndex) => (Array.isArray(group.items) ? group.items : []).map((item, itemIndex) => ({
    ...item,
    id: item.id || `tool-${groupIndex}-${itemIndex}`,
    groupIndex: String(groupIndex),
    groupLabel: item.groupLabel || group.label || "工具",
    groupTitle: item.groupTitle || group.title || "工具分类",
  })));
}

function findPriorityItems(groups, priority, limit) {
  const allItems = flattenToolGroups(groups).filter((item) => item.url);
  const byName = new Map(allItems.map((item) => [item.name, item]));
  const prioritized = priority.map((name) => byName.get(name)).filter(Boolean);
  const remainder = allItems.filter((item) => !priority.includes(item.name));
  return [...prioritized, ...remainder].slice(0, limit);
}

function renderSpotlight(animate = true) {
  const item = spotlightItems[spotlightIndex];
  if (!item) return;
  toolSpotlightLink.href = item.url;
  toolSpotlightLink.dataset.toolLink = "";
  toolSpotlightLink.dataset.toolName = item.name;
  toolSpotlightLink.dataset.toolDescription = item.description || "工具入口";
  toolSpotlightLink.dataset.toolGroupLabel = item.groupLabel || "快速入口";
  toolSpotlightLink.dataset.toolGroupTitle = item.groupTitle || "常用工具";
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

function setSpotlightFromGroups(groups) {
  spotlightItems = findPriorityItems(groups, spotlightPriority, 10);
  spotlightIndex = 0;
  renderSpotlight(false);
  startSpotlight();
}

function renderFeaturedTools(groups) {
  const items = findPriorityItems(groups, featuredToolPriority, 3);
  toolFeaturedGrid.innerHTML = items.map((item, index) => {
    const meta = featuredToolMeta[item.name] || { badge: index === 0 ? "精选工具" : "值得关注", summary: item.description || "实战工具入口。" };
    return `<article class="tool-featured-card">
      <div class="tool-featured-card-top">${renderToolLogo(item, "tool-logo-featured")}<span>${escapeToolHtml(meta.badge)}</span></div>
      <div><small>${escapeToolHtml(item.groupTitle)}</small><h3>${escapeToolHtml(item.name)}</h3><p>${escapeToolHtml(meta.summary)}</p></div>
      <a href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" data-tool-link data-tool-name="${escapeToolHtml(item.name)}" data-tool-description="${escapeToolHtml(item.description)}" data-tool-group-label="${escapeToolHtml(item.groupLabel)}" data-tool-group-title="${escapeToolHtml(item.groupTitle)}"><span>打开工具</span><b aria-hidden="true">↗</b></a>
    </article>`;
  }).join("");
}

function renderCommonTools(groups) {
  const items = findPriorityItems(groups, commonToolPriority, 5);
  toolCommonList.innerHTML = items.map((item) => `<a href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" data-tool-link data-tool-name="${escapeToolHtml(item.name)}" data-tool-description="${escapeToolHtml(item.description)}" data-tool-group-label="${escapeToolHtml(item.groupLabel)}" data-tool-group-title="${escapeToolHtml(item.groupTitle)}">${renderToolLogo(item, "tool-logo-common")}<span><strong>${escapeToolHtml(item.name)}</strong><small>${escapeToolHtml(item.description)}</small></span><b aria-hidden="true">↗</b></a>`).join("");
}

function renderCategoryFilters(groups) {
  if (!toolCategoryFilters) return;
  const allItems = flattenToolGroups(groups);
  const recentCount = readRecentTools().length;
  const favoriteCount = allItems.filter((item) => item.url && readFavoriteTools().has(item.url)).length;
  if (activeToolGroup !== "all" && activeToolGroup !== "recent" && activeToolGroup !== "favorites" && !groups[Number(activeToolGroup)]) activeToolGroup = "all";
  toolSidebarCount.textContent = String(allItems.length);
  toolCategoryFilters.innerHTML = [
    `<button class="${activeToolGroup === "all" ? "active" : ""}" type="button" data-tool-group="all" aria-pressed="${activeToolGroup === "all"}"><span>全部工具</span><b>${allItems.length}</b></button>`,
    `<button class="${activeToolGroup === "favorites" ? "active" : ""}" type="button" data-tool-group="favorites" aria-pressed="${activeToolGroup === "favorites"}"><span>我的收藏</span><b>${favoriteCount}</b></button>`,
    `<button class="${activeToolGroup === "recent" ? "active" : ""}" type="button" data-tool-group="recent" aria-pressed="${activeToolGroup === "recent"}"><span>最近使用</span><b>${recentCount}</b></button>`,
    ...groups.map((group, index) => `<button class="${activeToolGroup === String(index) ? "active" : ""}" type="button" data-tool-group="${index}" aria-pressed="${activeToolGroup === String(index)}"><span>${escapeToolHtml(group.title)}</span><b>${Array.isArray(group.items) ? group.items.length : 0}</b></button>`),
  ].join("");
}

function getVisibleToolItems(groups, query) {
  const allItems = flattenToolGroups(groups);
  const favorites = readFavoriteTools();
  const currentItemsByUrl = new Map(allItems.filter((item) => item.url).map((item) => [item.url, item]));
  let items;
  if (activeToolGroup === "recent") {
    items = readRecentTools().map((item) => currentItemsByUrl.get(item.url) || item);
  } else if (activeToolGroup === "favorites") {
    items = allItems.filter((item) => item.url && favorites.has(item.url));
  } else if (activeToolGroup === "all") {
    items = allItems;
  } else {
    items = allItems.filter((item) => item.groupIndex === activeToolGroup);
  }

  const keyword = normalizeToolText(query);
  if (keyword) items = items.filter((item) => normalizeToolText(`${item.name} ${item.description} ${item.groupLabel} ${item.groupTitle}`).includes(keyword));

  const sortMode = toolSort.value;
  if (sortMode === "name") {
    items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-CN"));
  } else if (sortMode === "recent") {
    const recentOrder = new Map(readRecentTools().map((item, index) => [item.url, index]));
    items = [...items].sort((a, b) => (recentOrder.get(a.url) ?? Number.MAX_SAFE_INTEGER) - (recentOrder.get(b.url) ?? Number.MAX_SAFE_INTEGER));
  }
  return items;
}

function getToolResultTitle(groups, query) {
  if (query) return `搜索“${query}”`;
  if (activeToolGroup === "recent") return "最近使用";
  if (activeToolGroup === "favorites") return "我的收藏";
  if (activeToolGroup === "all") return "全部工具";
  return groups[Number(activeToolGroup)]?.title || "工具目录";
}

function renderDirectoryCard(item, favorites) {
  const isFavorite = Boolean(item.url && favorites.has(item.url));
  const name = escapeToolHtml(item.name || "工具入口");
  const description = escapeToolHtml(item.description || "工具入口");
  const dataAttributes = `data-tool-name="${name}" data-tool-description="${description}" data-tool-group-label="${escapeToolHtml(item.groupLabel)}" data-tool-group-title="${escapeToolHtml(item.groupTitle)}"`;
  return `<article class="tool-directory-card">
    <div class="tool-directory-card-top">
      ${renderToolLogo(item, "tool-logo-card")}
      ${item.url ? `<button class="tool-favorite-button ${isFavorite ? "is-favorite" : ""}" type="button" data-favorite-url="${escapeToolHtml(item.url)}" aria-label="${isFavorite ? `取消收藏 ${name}` : `收藏 ${name}`}" aria-pressed="${isFavorite}"><span aria-hidden="true">${isFavorite ? "★" : "☆"}</span></button>` : ""}
    </div>
    <div class="tool-directory-card-copy"><span class="tool-card-category">${escapeToolHtml(item.groupTitle)}</span><h3>${item.url ? `<a href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" data-tool-link ${dataAttributes}>${name}</a>` : name}</h3><p>${description}</p></div>
    ${item.url ? `<a class="tool-card-open" href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer" data-tool-link ${dataAttributes}><span>打开工具</span><b aria-hidden="true">↗</b></a>` : `<span class="tool-card-unavailable">暂无入口</span>`}
  </article>`;
}

function renderToolGroups(groups, query = "") {
  const sourceGroups = Array.isArray(groups) ? groups : [];
  const visibleItems = getVisibleToolItems(sourceGroups, query);
  const shownItems = visibleItems.slice(0, visibleToolLimit);
  const favorites = readFavoriteTools();

  toolResultTitle.textContent = getToolResultTitle(sourceGroups, query);
  toolResultCount.textContent = `共 ${visibleItems.length} 个工具`;
  toolDisplayStatus.textContent = visibleItems.length ? `已显示 ${shownItems.length} / ${visibleItems.length}` : "等待筛选结果";
  toolLoadMore.hidden = shownItems.length >= visibleItems.length;

  if (!visibleItems.length) {
    const emptyTitle = activeToolGroup === "favorites" ? "还没有收藏工具" : activeToolGroup === "recent" ? "还没有最近使用记录" : "没有找到相关工具";
    categoryGrid.innerHTML = `<div class="tool-search-empty"><strong>${emptyTitle}</strong><span>${activeToolGroup === "favorites" ? "点击工具卡片右上角的星标即可收藏。" : "试试搜索“钱包”“空投”“跨链”或具体工具名称。"}</span></div>`;
    updateSearchControls(query);
    return;
  }

  categoryGrid.innerHTML = `<div class="tool-directory-card-grid">${shownItems.map((item) => renderDirectoryCard(item, favorites)).join("")}</div>`;
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

function applyToolFilters() {
  const query = toolSearch.value.trim();
  visibleToolLimit = toolBatchSize;
  if (!toolboxData) return;
  renderToolGroups(toolboxData.toolGroups, query);
}

function renderToolbox(data) {
  const toolGroups = Array.isArray(data.toolGroups) ? data.toolGroups : [];
  toolboxData = { ...data, toolGroups };
  if (Array.isArray(data.essentials) && data.essentials.length) {
    essentialGrid.innerHTML = data.essentials.map((item) => `
      <article class="essential-card">
        <div class="essential-card-top"><img src="${getEssentialLogo(item.name)}" alt="" /><span>${escapeToolHtml(item.type || "入口")}</span></div>
        <h3>${escapeToolHtml(item.name)}</h3>
        ${item.code ? `<div class="essential-code"><span>邀请码</span><strong>${escapeToolHtml(item.code)}</strong><button type="button" data-copy-code="${escapeToolHtml(item.code)}">复制</button></div>` : ""}
        ${item.url ? `<a class="tool-action" href="${escapeToolHtml(item.url)}" target="_blank" rel="noopener noreferrer"><span>链接直达</span><b aria-hidden="true">↗</b></a>` : ""}
      </article>`).join("");
  }
  renderCategoryFilters(toolGroups);
  setSpotlightFromGroups(toolGroups);
  renderFeaturedTools(toolGroups);
  renderCommonTools(toolGroups);
  renderToolGroups(toolGroups, toolSearch.value.trim());
}

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.closest("[data-tool-logo]")) return;
  if (image.dataset.logoStage === "local" && image.dataset.toolUrl) {
    image.dataset.logoStage = "remote";
    image.src = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(image.dataset.toolUrl)}&sz=256`;
    return;
  }
  image.hidden = true;
  image.closest("[data-tool-logo]")?.classList.add("is-fallback");
}, true);

toolSearch.addEventListener("input", applyToolFilters);
toolSearchClear.addEventListener("click", () => {
  toolSearch.value = "";
  toolSearch.focus();
  applyToolFilters();
});
toolSort.addEventListener("change", applyToolFilters);

essentialGrid.addEventListener("click", (event) => {
  const copyButton = event.target.closest("button[data-copy-code]");
  if (copyButton) copyToolCode(copyButton);
});

document.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("button[data-favorite-url]");
  if (favoriteButton && toolboxData) {
    const favorites = readFavoriteTools();
    const url = favoriteButton.dataset.favoriteUrl;
    if (favorites.has(url)) favorites.delete(url);
    else favorites.add(url);
    writeFavoriteTools(favorites);
    renderCategoryFilters(toolboxData.toolGroups);
    renderToolGroups(toolboxData.toolGroups, toolSearch.value.trim());
    return;
  }

  const link = event.target.closest("a[data-tool-link]");
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
  visibleToolLimit = toolBatchSize;
  renderCategoryFilters(toolboxData.toolGroups);
  renderToolGroups(toolboxData.toolGroups, toolSearch.value.trim());
});

toolLoadMore.addEventListener("click", () => {
  if (!toolboxData) return;
  visibleToolLimit += toolBatchSize;
  renderToolGroups(toolboxData.toolGroups, toolSearch.value.trim());
});

const toolUrlQuery = new URLSearchParams(window.location.search).get("q") || "";
toolSearch.value = toolUrlQuery;
const staticToolGroups = readStaticToolGroups();
renderToolbox({ toolGroups: staticToolGroups });

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
