const campaignBody = document.getElementById("campaignTableBody");
const campaignDisclaimer = document.getElementById("campaignDisclaimer");
const campaignSource = document.getElementById("campaignSource");
const campaignEmpty = document.getElementById("campaignEmpty");
const exchangeFilters = document.getElementById("exchangeFilters");
const campaignSearch = document.getElementById("campaignSearch");
const campaignSort = document.getElementById("campaignSort");
const campaignAudience = document.getElementById("campaignAudience");
const campaignTerm = document.getElementById("campaignTerm");
const verifiedCount = document.getElementById("verifiedCount");
const exchangeCount = document.getElementById("exchangeCount");
const updatedAt = document.getElementById("updatedAt");
const wealthDataFreshness = document.getElementById("wealthDataFreshness");

const state = {
  data: null,
  exchange: "all",
  query: "",
  sort: "deadline",
  audience: "all",
  term: "all",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getActivityMeta(exchange) {
  const exchanges = Array.isArray(state.data?.exchanges) ? state.data.exchanges : [];
  return exchanges.find((item) => item.name === exchange) || { name: exchange, shortName: exchange };
}

function renderExchangeLogo(meta, className = "exchange-logo") {
  if (!meta.logo) return "";
  return `<img class="${className}" src="${escapeHtml(meta.logo)}" alt="${escapeHtml(meta.name)} Logo" width="58" height="58" loading="lazy" />`;
}

function getDateTimestamp(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function isExpired(item) {
  const timestamp = getDateTimestamp(item.endAt);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function formatUpdatedAt(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "—";
}

function getDatasetFreshness(value) {
  const normalized = String(value || "").replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+\(UTC\+8\)$/, "$1T$2:00+08:00");
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) return { stale: true, label: "尚未记录维护时间", detail: "请回到官方来源核验" };
  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  const relative = ageHours < 1 ? "刚刚维护" : ageHours < 24 ? `${ageHours} 小时前维护` : `${Math.floor(ageHours / 24)} 天前维护`;
  const stale = ageMs > STALE_AFTER_MS;
  return {
    stale,
    label: `${relative}${stale ? " · 需要复核" : ""}`,
    detail: `最后维护 ${new Date(timestamp).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`,
  };
}

function renderDatasetFreshness(value) {
  if (!wealthDataFreshness) return;
  const freshness = getDatasetFreshness(value);
  wealthDataFreshness.classList.toggle("stale", freshness.stale);
  wealthDataFreshness.innerHTML = `<span>${freshness.stale ? "需要复核" : "数据已维护"}</span><strong>${escapeHtml(freshness.label)}</strong><small>${escapeHtml(freshness.detail)}</small>`;
}

function getRemainingLabel(item) {
  const timestamp = getDateTimestamp(item.endAt);
  if (!Number.isFinite(timestamp)) return "以首次申购时间计算";
  const remainingDays = Math.ceil((timestamp - Date.now()) / (24 * 60 * 60 * 1000));
  if (remainingDays <= 1) return "即将结束";
  return `剩余 ${remainingDays} 天`;
}

function getActivityStatus(item) {
  const now = Date.now();
  const start = getDateTimestamp(item.startsAt);
  const end = getDateTimestamp(item.endAt);
  if (Number.isFinite(start) && start > now) return { label: "待开始", className: "upcoming" };
  if (Number.isFinite(end) && end - now <= 3 * DAY_MS) return { label: "即将结束", className: "ending" };
  return { label: "进行中", className: "active" };
}

function getVerificationMeta(item) {
  const timestamp = getDateTimestamp(item.lastVerifiedAt);
  if (!Number.isFinite(timestamp)) return { label: "尚未记录核验时间", stale: true };
  const stale = Date.now() - timestamp > STALE_AFTER_MS;
  const date = new Date(timestamp).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  return { label: stale ? `上次核验 ${date} · 建议复核` : `核验于 ${date}`, stale };
}

async function fetchCampaigns() {
  const endpoints = ["/api/cex-yields", "../data/cex-yields.json"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (response.ok) return response.json();
    } catch {
      // Continue so GitHub Pages and local previews use the static data fallback.
    }
  }

  throw new Error("无法加载交易所理财数据");
}

function renderExchangeFilters(data) {
  const exchanges = Array.isArray(data.exchanges) ? data.exchanges : [];
  const filters = [{ name: "all", label: "全部", logo: "" }, ...exchanges.map((item) => ({ name: item.name, label: item.shortName || item.name, logo: item.logo }))];

  exchangeFilters.innerHTML = filters
    .map(
      (filter) => `
        <button class="exchange-filter${filter.name === state.exchange ? " active" : ""}" type="button" data-exchange="${escapeHtml(filter.name)}" aria-pressed="${filter.name === state.exchange}">
          ${filter.logo ? `<img src="${escapeHtml(filter.logo)}" alt="" width="18" height="18" />` : ""}
          ${escapeHtml(filter.label)}
        </button>
      `,
    )
    .join("");
}

function filteredCampaigns() {
  const campaigns = Array.isArray(state.data?.campaigns) ? state.data.campaigns : [];
  const query = state.query.trim().toLowerCase();
  const visible = campaigns.filter((item) => {
    const matchesExchange = state.exchange === "all" || item.exchange === state.exchange;
    const matchesQuery = !query || `${item.activity} ${item.venue} ${item.exchange}`.toLowerCase().includes(query);
    const matchesAudience = state.audience === "all" || (state.audience === "new" && /新用户/.test(item.eligibility || item.activity));
    const matchesTerm = state.term === "all" || String(item.productType || "").toLowerCase() === state.term;
    return matchesExchange && matchesQuery && matchesAudience && matchesTerm && !isExpired(item);
  });

  return visible.sort((a, b) => {
    if (state.sort === "apy") return Number(b.apyValue || 0) - Number(a.apyValue || 0);
    return getDateTimestamp(a.endAt) - getDateTimestamp(b.endAt);
  });
}

function renderCampaigns() {
  const campaigns = filteredCampaigns();
  campaignEmpty.hidden = campaigns.length > 0;

  if (!campaigns.length) {
    campaignBody.innerHTML = "";
    return;
  }

  campaignBody.innerHTML = campaigns
    .map((item) => {
      const meta = getActivityMeta(item.exchange);
      const status = getActivityStatus(item);
      const verification = getVerificationMeta(item);
      const activityContent = `<span class="activity-title-line"><strong>${escapeHtml(item.activity)}</strong><span class="campaign-status ${status.className}">${status.label}</span></span><small>${escapeHtml(item.venue)}</small><small class="verification-label${verification.stale ? " stale" : ""}">${escapeHtml(verification.label)}</small>`;
      const activity = item.sourceUrl
        ? `<a class="activity-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${activityContent}</a>`
        : `<span>${activityContent}</span>`;

      return `
        <tr class="campaign-row">
          <td data-label="活动">
            <div class="activity-cell">
              ${renderExchangeLogo(meta)}
              ${activity}
            </div>
          </td>
          <td data-label="年利率"><strong class="apy-value">${escapeHtml(item.apy)}</strong></td>
          <td data-label="到期时间（当地）">
            <div class="deadline-cell"><strong>${escapeHtml(item.endTime)}</strong><small>${escapeHtml(getRemainingLabel(item))}</small></div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSummary(data) {
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const exchanges = Array.isArray(data.exchanges) ? data.exchanges : [];
  const active = campaigns.filter((item) => !isExpired(item));

  verifiedCount.textContent = String(active.length);
  exchangeCount.textContent = String(exchanges.length || 5);
  updatedAt.textContent = formatUpdatedAt(data.updatedAt);
  campaignDisclaimer.textContent = data.notice || "数据仅供研究，不构成投资建议。";
  campaignSource.textContent = data.source === "official" ? "来源：交易所公开规则页 · 点击活动名称核验" : "来源：站点维护数据";
  renderDatasetFreshness(data.updatedAt);
}

function render() {
  if (!state.data) return;
  renderExchangeFilters(state.data);
  renderSummary(state.data);
  renderCampaigns();
}

exchangeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-exchange]");
  if (!button) return;
  state.exchange = button.dataset.exchange || "all";
  render();
});

campaignSearch.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderCampaigns();
});

campaignSort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderCampaigns();
});

campaignAudience.addEventListener("change", (event) => {
  state.audience = event.target.value;
  renderCampaigns();
});

campaignTerm.addEventListener("change", (event) => {
  state.term = event.target.value;
  renderCampaigns();
});

function readInitialCampaigns() {
  const element = document.getElementById("campaignInitialData");
  if (!element?.textContent.trim()) return null;
  try {
    return JSON.parse(element.textContent);
  } catch (error) {
    console.warn("理财活动首屏数据无法解析。", error);
    return null;
  }
}

function applyUrlFilters() {
  const query = new URLSearchParams(window.location.search).get("q");
  if (!query) return;
  state.query = query;
  campaignSearch.value = query;
}

applyUrlFilters();
const initialCampaigns = readInitialCampaigns();
if (Array.isArray(initialCampaigns?.campaigns)) {
  state.data = initialCampaigns;
  render();
}

fetchCampaigns()
  .then((data) => {
    state.data = data;
    render();
  })
  .catch((error) => {
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="3">${escapeHtml(error.message)}</td></tr>`;
    campaignDisclaimer.textContent = "数据加载失败，请稍后重试。";
  });
