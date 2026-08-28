const pageSize = 10;
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;
const PROJECT_LOGO_VERSION = "20260828-logo1";
const MISSING_VALUES = new Set(["", "待补", "待补充"]);

let activeView = "2026";
let currentPage = 1;
let keyword = "";
let statusFilter = "进行中";
let sortOrder = "default";
let dataByYear = groupProjects(flattenFallbackData(window.airdropData));
let dataUpdatedAt = "";

const body = document.getElementById("airdropTableBody");
const tabs = document.getElementById("airdropViewTabs");
const pagination = document.getElementById("airdropPagination");
const searchInput = document.getElementById("airdropSearch");
const statusSelect = document.getElementById("airdropStatusFilter");
const sortSelect = document.getElementById("airdropSort");
const freshnessPanel = document.getElementById("airdropDataFreshness");
const summary = document.querySelector(".tracker-summary");
const detailDialog = document.getElementById("airdropDetailDialog");
const detailLogo = document.getElementById("airdropDetailLogo");
const detailTitle = document.getElementById("airdropDetailTitle");
const detailCategory = document.getElementById("airdropDetailCategory");
const detailContent = document.getElementById("airdropDetailContent");
const detailClose = document.getElementById("airdropDetailClose");
const labels = ["名称", "类别", "融资", "投资机构", "成本", "建议上号", "状态", "利润", "任务链接", "备注"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function flattenFallbackData(data) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).flatMap(([year, projects]) => (projects || []).map((project) => ({ ...project, year })));
}

function cleanProjectName(value) {
  return String(value || "未命名项目").replace(/\s*[（(]20\d{2}[）)]\s*$/, "").trim();
}

function projectInitials(value) {
  const name = cleanProjectName(value);
  const words = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function projectLogoMarkup(item, className = "") {
  const logoId = String(item?._logoId || item?.id || "").trim();
  const safeLogoId = /^[a-z0-9-]+$/i.test(logoId) ? logoId : "";
  const image = safeLogoId
    ? `<img src="../assets/airdrops/${escapeHtml(safeLogoId)}.png?v=${PROJECT_LOGO_VERSION}" alt="" loading="lazy" decoding="async">`
    : "";
  return `<span class="airdrop-project-logo${className ? ` ${className}` : ""}" aria-hidden="true"><span>${escapeHtml(projectInitials(item?.name))}</span>${image}</span>`;
}

function bindLogoFallbacks(scope) {
  scope.querySelectorAll(".airdrop-project-logo img").forEach((image) => {
    image.addEventListener("error", () => image.remove(), { once: true });
  });
}

function isMissing(value) {
  return MISSING_VALUES.has(String(value || "").trim());
}

function needsVerification(item) {
  return [item.category, item.cost, item.accounts].some(isMissing) || !item.link;
}

function getDisplayStatus(item) {
  return needsVerification(item) ? "待核验" : item.status === "已空投" ? "已空投" : "进行中";
}

function statusClass(status) {
  if (status === "已空投") return " done";
  if (status === "待核验") return " pending";
  return "";
}

function cell(label, value, className = "") {
  const text = value || "待补";
  const muted = !value || ["待补", "待补充", "未公布", "待观察"].includes(text);
  const classes = [className, muted ? "muted" : ""].filter(Boolean).join(" ");
  return `<td data-label="${label}" class="${classes}">${escapeHtml(text)}</td>`;
}

function groupProjects(projects) {
  const yearCounters = {};
  return (projects || []).reduce((groups, project, index) => {
    const year = String(project.year || "2026");
    yearCounters[year] = (yearCounters[year] || 0) + 1;
    const fallbackLogoId = `seed-${year}-${String(yearCounters[year]).padStart(2, "0")}`;
    (groups[year] ||= []).push({
      ...project,
      year,
      _order: index,
      _key: project.id || `${year}-${index}`,
      _logoId: project.logoId || project.id || fallbackLogoId,
    });
    return groups;
  }, { "2026": [], "2025": [] });
}

function parseFunding(value) {
  const text = String(value || "").replaceAll(",", "").toLowerCase();
  const number = Number.parseFloat(text.match(/\d+(?:\.\d+)?/)?.[0] || "0");
  if (text.includes("亿")) return number * 100_000_000;
  if (text.includes("万") || /\d(?:\.\d+)?w\b/.test(text)) return number * 10_000;
  if (/\d(?:\.\d+)?b\b/.test(text)) return number * 1_000_000_000;
  if (/\d(?:\.\d+)?m\b/.test(text)) return number * 1_000_000;
  if (/\d(?:\.\d+)?k\b/.test(text)) return number * 1_000;
  return number;
}

function sortItems(items) {
  const sorted = [...items];
  if (sortOrder === "name") return sorted.sort((a, b) => cleanProjectName(a.name).localeCompare(cleanProjectName(b.name), "zh-CN"));
  if (sortOrder === "funding") return sorted.sort((a, b) => parseFunding(b.funding) - parseFunding(a.funding));
  if (sortOrder === "status") {
    const rank = { "进行中": 0, "待核验": 1, "已空投": 2 };
    return sorted.sort((a, b) => rank[getDisplayStatus(a)] - rank[getDisplayStatus(b)] || a._order - b._order);
  }
  return sorted.sort((a, b) => a._order - b._order);
}

function getFilteredItems() {
  const query = keyword.trim().toLocaleLowerCase("zh-CN");
  const filtered = (dataByYear[activeView] || []).filter((item) => {
    const displayStatus = getDisplayStatus(item);
    const statusMatched = statusFilter === "全部" || displayStatus === statusFilter;
    const haystack = [cleanProjectName(item.name), item.category, item.funding, item.investors, item.cost, item.accounts, displayStatus, item.profit, item.note]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return statusMatched && (!query || haystack.includes(query));
  });
  return sortItems(filtered);
}

function renderSummary(allItems) {
  const counts = allItems.reduce((result, item) => {
    result[getDisplayStatus(item)] += 1;
    return result;
  }, { "进行中": 0, "已空投": 0, "待核验": 0 });

  document.getElementById("summaryTotal").textContent = allItems.length;
  document.getElementById("summaryActive").textContent = counts["进行中"];
  document.getElementById("summaryDone").textContent = counts["已空投"];
  document.getElementById("summaryPending").textContent = counts["待核验"];

  summary.querySelectorAll("[data-summary-status]").forEach((button) => {
    const selected = button.dataset.summaryStatus === statusFilter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderTabs() {
  tabs.querySelectorAll("button").forEach((button) => {
    const selected = button.dataset.view === activeView;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
}

function renderTable() {
  const allItems = dataByYear[activeView] || [];
  const items = getFilteredItems();
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  if (!pageItems.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="${labels.length}"><strong>没有匹配的项目</strong><span>调整年份、状态或搜索关键词后再试。</span></td></tr>`;
  } else {
    body.innerHTML = pageItems.map((item) => {
      const displayStatus = getDisplayStatus(item);
      const link = item.link
        ? `<a class="table-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" data-no-detail>任务 ↗</a>`
        : `<button class="table-link muted-link" type="button" data-open-detail="${escapeHtml(item._key)}">待补</button>`;
      return `
        <tr class="airdrop-project-row" data-project-id="${escapeHtml(item._key)}" tabindex="0" aria-label="查看 ${escapeHtml(cleanProjectName(item.name))} 详情">
          <td data-label="名称"><span class="project-name-identity">${projectLogoMarkup(item)}<span class="project-name-cell"><strong>${escapeHtml(cleanProjectName(item.name))}</strong><small>查看详情</small></span></span></td>
          ${cell("类别", item.category)}
          ${cell("融资", item.funding, item.funding && !["未公布", "待补充"].includes(item.funding) ? "money" : "")}
          ${cell("投资机构", item.investors, "mobile-secondary")}
          ${cell("成本", item.cost)}
          ${cell("建议上号", item.accounts, "mobile-secondary")}
          <td data-label="状态"><span class="status-pill${statusClass(displayStatus)}">${escapeHtml(displayStatus)}</span></td>
          ${cell("利润", item.profit, item.profit && item.profit !== "待观察" ? "profit" : "")}
          <td data-label="任务链接">${link}</td>
          <td data-label="备注" class="note-cell mobile-secondary">${escapeHtml(item.note || "—")}</td>
        </tr>`;
    }).join("");
    bindLogoFallbacks(body);
  }

  renderSummary(allItems);
  renderTabs();
  renderPagination(pages, items.length, allItems.length);
  syncUrlState();
}

function renderPagination(pages, total, yearTotal) {
  if (pages <= 1) {
    pagination.innerHTML = `<span>显示 ${total} 个结果，共 ${yearTotal} 个项目</span>`;
    return;
  }

  const buttons = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === currentPage ? "selected" : ""}" type="button" data-page="${page}" aria-label="第 ${page} 页">${page}</button>`;
  }).join("");

  pagination.innerHTML = `
    <span>显示 ${total} 个结果，共 ${yearTotal} 个项目</span>
    <div>
      <button type="button" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? "disabled" : ""}>上一页</button>
      ${buttons}
      <button type="button" data-page="${Math.min(pages, currentPage + 1)}" ${currentPage === pages ? "disabled" : ""}>下一页</button>
    </div>`;
}

function findProject(key) {
  return Object.values(dataByYear).flat().find((item) => item._key === key);
}

function detailItem(label, value, className = "") {
  return `<div class="airdrop-detail-item ${className}"><span>${label}</span><strong>${escapeHtml(value || "待补充")}</strong></div>`;
}

function openProjectDetail(item) {
  if (!item) return;
  const displayStatus = getDisplayStatus(item);
  detailLogo.innerHTML = projectLogoMarkup(item, "detail-logo");
  bindLogoFallbacks(detailLogo);
  detailTitle.textContent = cleanProjectName(item.name);
  detailCategory.textContent = item.category && !isMissing(item.category) ? item.category : "待核验项目";
  detailContent.innerHTML = `
    <div class="airdrop-detail-status">
      <span class="status-pill${statusClass(displayStatus)}">${escapeHtml(displayStatus)}</span>
      <span>${escapeHtml(item.year)} 年项目视图</span>
    </div>
    ${displayStatus === "待核验" ? '<div class="airdrop-detail-alert"><strong>关键信息仍需核验</strong><p>任务入口或项目基础信息尚未补全，参与前请先确认官方来源。</p></div>' : ""}
    <section class="airdrop-detail-grid" aria-label="项目核心信息">
      ${detailItem("融资", item.funding)}
      ${detailItem("参考成本", item.cost)}
      ${detailItem("投资机构", item.investors, "wide")}
      ${detailItem("建议上号", item.accounts)}
      ${detailItem("利润记录", item.profit)}
    </section>
    <section class="airdrop-detail-block">
      <span>备注</span>
      <p>${escapeHtml(item.note || "暂时没有补充说明。")}</p>
    </section>
    <section class="airdrop-detail-block source-block">
      <div><span>项目来源</span><p>${item.link ? "前往项目公开页面继续核验任务和规则。" : "尚未补充可核验的项目入口。"}</p></div>
      ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">打开项目页面 ↗</a>` : '<span class="source-missing">等待补充</span>'}
    </section>
    <section class="airdrop-risk-note">
      <strong>参与前检查</strong>
      <p>确认域名、钱包授权、地区资格和实际成本。项目规则可能变化，请以项目公开页面为准。</p>
    </section>`;
  if (!detailDialog.open) detailDialog.showModal();
}

function syncUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set("year", activeView);
  if (statusFilter === "全部") url.searchParams.delete("status");
  else url.searchParams.set("status", statusFilter);
  if (keyword.trim()) url.searchParams.set("q", keyword.trim());
  else url.searchParams.delete("q");
  if (sortOrder === "default") url.searchParams.delete("sort");
  else url.searchParams.set("sort", sortOrder);
  window.history.replaceState({}, "", url);
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  const year = params.get("year");
  const status = params.get("status");
  const query = params.get("q");
  const sort = params.get("sort");
  if (year === "2025" || year === "2026") activeView = year;
  if (activeView === "2025" && !status) statusFilter = "全部";
  if (["全部", "进行中", "已空投", "待核验"].includes(status)) statusFilter = status;
  if (["default", "name", "funding", "status"].includes(sort)) sortOrder = sort;
  if (query) keyword = query;
  statusSelect.value = statusFilter;
  sortSelect.value = sortOrder;
  searchInput.value = keyword;
}

function readInitialData() {
  const element = document.getElementById("airdropInitialData");
  if (!element?.textContent.trim()) return null;
  try {
    const parsed = JSON.parse(element.textContent);
    return Array.isArray(parsed?.projects) && parsed.projects.length ? parsed : null;
  } catch (error) {
    console.warn("空投首屏数据无法解析。", error);
    return null;
  }
}

function renderFreshness(value) {
  if (!freshnessPanel) return;
  const timestamp = Date.parse(value || "");
  const invalid = Number.isNaN(timestamp);
  const ageMs = invalid ? Number.POSITIVE_INFINITY : Math.max(0, Date.now() - timestamp);
  const stale = ageMs > STALE_AFTER_MS;
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  const relative = invalid ? "尚未记录维护时间" : ageHours < 1 ? "刚刚维护" : ageHours < 24 ? `${ageHours} 小时前维护` : `${Math.floor(ageHours / 24)} 天前维护`;
  const date = invalid ? "请回到项目来源核验" : `最后维护 ${new Date(timestamp).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`;

  freshnessPanel.classList.toggle("stale", stale);
  freshnessPanel.innerHTML = `<span>${stale ? "需要复核" : "数据已维护"}</span><strong>${escapeHtml(relative)}${stale && !invalid ? " · 需要复核" : ""}</strong><small>${escapeHtml(date)}</small>`;
}

function applyPayload(payload) {
  if (!Array.isArray(payload?.projects) || !payload.projects.length) return false;
  dataByYear = groupProjects(payload.projects);
  dataUpdatedAt = payload.updatedAt || "";
  currentPage = 1;
  renderFreshness(dataUpdatedAt);
  renderTable();
  return true;
}

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  activeView = button.dataset.view;
  statusFilter = activeView === "2025" ? "全部" : "进行中";
  statusSelect.value = statusFilter;
  currentPage = 1;
  renderTable();
});

summary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-summary-status]");
  if (!button) return;
  statusFilter = statusFilter === button.dataset.summaryStatus ? "全部" : button.dataset.summaryStatus;
  statusSelect.value = statusFilter;
  currentPage = 1;
  renderTable();
});

searchInput.addEventListener("input", (event) => {
  keyword = event.target.value;
  currentPage = 1;
  renderTable();
});

statusSelect.addEventListener("change", (event) => {
  statusFilter = event.target.value;
  currentPage = 1;
  renderTable();
});

sortSelect.addEventListener("change", (event) => {
  sortOrder = event.target.value;
  currentPage = 1;
  renderTable();
});

pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderTable();
  document.querySelector(".airdrop-table-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

body.addEventListener("click", (event) => {
  if (event.target.closest("[data-no-detail]")) return;
  const trigger = event.target.closest("[data-open-detail], .airdrop-project-row");
  if (!trigger) return;
  openProjectDetail(findProject(trigger.dataset.openDetail || trigger.dataset.projectId || trigger.closest(".airdrop-project-row")?.dataset.projectId));
});

body.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key) || event.target.closest("a, button")) return;
  const row = event.target.closest(".airdrop-project-row");
  if (!row) return;
  event.preventDefault();
  openProjectDetail(findProject(row.dataset.projectId));
});

detailClose.addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("click", (event) => {
  if (event.target === detailDialog) detailDialog.close();
});

async function loadProjects() {
  applyUrlFilters();
  const initial = readInitialData();
  if (!applyPayload(initial)) {
    renderFreshness(dataUpdatedAt);
    renderTable();
  }
  try {
    const response = await fetch("../api/airdrop-projects", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    applyPayload(await response.json());
  } catch (error) {
    console.warn("空投动态数据暂时不可用，已使用页面备用数据。", error);
  }
}

loadProjects();
