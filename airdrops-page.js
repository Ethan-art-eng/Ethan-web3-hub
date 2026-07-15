const pageSize = 10;
let activeView = "2026";
let currentPage = 1;
let keyword = "";
let statusFilter = "全部";
let dataByYear = window.airdropData || { "2026": [], "2025": [] };
let dataUpdatedAt = "";

const body = document.getElementById("airdropTableBody");
const tabs = document.getElementById("airdropViewTabs");
const pagination = document.getElementById("airdropPagination");
const searchInput = document.getElementById("airdropSearch");
const statusSelect = document.getElementById("airdropStatusFilter");
const freshnessPanel = document.getElementById("airdropDataFreshness");
const labels = ["名称", "类别", "融资", "投资机构", "成本", "建议上号", "状态", "利润", "任务链接", "备注"];
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cell(label, value, className = "") {
  const text = value || "待补";
  const muted = !value || ["待补", "待补充", "未公布", "待观察"].includes(text);
  return `<td data-label="${label}" class="${className || (muted ? "muted" : "")}">${escapeHtml(text)}</td>`;
}

function getFilteredItems() {
  const items = dataByYear[activeView] || [];
  const query = keyword.trim().toLowerCase();

  return items.filter((item) => {
    const statusMatched = statusFilter === "全部" || item.status === statusFilter;
    const haystack = [
      item.name,
      item.category,
      item.funding,
      item.investors,
      item.cost,
      item.accounts,
      item.status,
      item.profit,
      item.note,
    ]
      .join(" ")
      .toLowerCase();
    return statusMatched && (!query || haystack.includes(query));
  });
}

function renderSummary(items, allItems) {
  const total = allItems.length;
  const done = allItems.filter((item) => item.status === "已空投").length;
  const active = total - done;
  document.getElementById("summaryTotal").textContent = total;
  document.getElementById("summaryActive").textContent = active;
  document.getElementById("summaryDone").textContent = done;
}

function renderTabs() {
  tabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.view === activeView);
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
    body.innerHTML = `<tr class="empty-row"><td colspan="${labels.length}">没有匹配的项目</td></tr>`;
  } else {
    body.innerHTML = pageItems
      .map((item) => {
        const doneClass = item.status === "已空投" ? " done" : "";
        const link = item.link
          ? `<a class="table-link" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">打开</a>`
          : `<span class="muted">待补</span>`;
        return `
          <tr>
            <td data-label="名称"><strong>${escapeHtml(item.name)}</strong></td>
            ${cell("类别", item.category)}
            ${cell("融资", item.funding, item.funding && item.funding !== "未公布" && item.funding !== "待补充" ? "money" : "")}
            ${cell("投资机构", item.investors)}
            ${cell("成本", item.cost)}
            ${cell("建议上号", item.accounts)}
            <td data-label="状态"><span class="status-pill${doneClass}">${escapeHtml(item.status || "进行中")}</span></td>
            ${cell("利润", item.profit, item.profit && item.profit !== "待观察" ? "profit" : "")}
            <td data-label="任务链接">${link}</td>
            ${cell("备注", item.note)}
          </tr>
        `;
      })
      .join("");
  }

  renderSummary(items, allItems);
  renderTabs();
  renderPagination(pages, items.length);
}

function renderPagination(pages, total) {
  if (pages <= 1) {
    pagination.innerHTML = `<span>当前显示 ${total} 个项目</span>`;
    return;
  }

  const buttons = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === currentPage ? "selected" : ""}" type="button" data-page="${page}">${page}</button>`;
  }).join("");

  pagination.innerHTML = `
    <span>每页 ${pageSize} 个，当前显示 ${total} 个项目</span>
    <div>
      <button type="button" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? "disabled" : ""}>上一页</button>
      ${buttons}
      <button type="button" data-page="${Math.min(pages, currentPage + 1)}" ${currentPage === pages ? "disabled" : ""}>下一页</button>
    </div>
  `;
}

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  activeView = button.dataset.view;
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

pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderTable();
});

function groupProjects(projects) {
  return projects.reduce((groups, project) => {
    (groups[project.year] ||= []).push(project);
    return groups;
  }, {});
}

function readInitialData() {
  const element = document.getElementById("airdropInitialData");
  if (!element?.textContent.trim()) return null;
  try {
    return JSON.parse(element.textContent);
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
  const relative = invalid
    ? "尚未记录维护时间"
    : ageHours < 1
      ? "刚刚维护"
      : ageHours < 24
        ? `${ageHours} 小时前维护`
        : `${Math.floor(ageHours / 24)} 天前维护`;
  const date = invalid
    ? "请回到官方来源核验"
    : `最后维护 ${new Date(timestamp).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`;

  freshnessPanel.classList.toggle("stale", stale);
  freshnessPanel.innerHTML = `<span>${stale ? "需要复核" : "数据已维护"}</span><strong>${escapeHtml(relative)}${stale && !invalid ? " · 需要复核" : ""}</strong><small>${escapeHtml(date)}</small>`;
}

function applyPayload(payload) {
  if (!Array.isArray(payload?.projects)) return false;
  dataByYear = groupProjects(payload.projects);
  dataUpdatedAt = payload.updatedAt || "";
  currentPage = 1;
  renderFreshness(dataUpdatedAt);
  renderTable();
  return true;
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  const year = params.get("year");
  const status = params.get("status");
  const query = params.get("q");
  if (year === "2025" || year === "2026") activeView = year;
  if (status === "进行中" || status === "已空投") {
    statusFilter = status;
    statusSelect.value = status;
  }
  if (query) {
    keyword = query;
    searchInput.value = query;
  }
}

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
    const payload = await response.json();
    applyPayload(payload);
  } catch (error) {
    console.warn("空投动态数据暂时不可用，已使用页面备用数据。", error);
  }
}

loadProjects();
