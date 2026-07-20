const campaignBody = document.getElementById("campaignTableBody");
const campaignDisclaimer = document.getElementById("campaignDisclaimer");
const campaignSource = document.getElementById("campaignSource");
const campaignEmpty = document.getElementById("campaignEmpty");
const exchangeFilters = document.getElementById("exchangeFilters");
const campaignSearch = document.getElementById("campaignSearch");
const campaignSort = document.getElementById("campaignSort");
const campaignAudience = document.getElementById("campaignAudience");
const campaignTerm = document.getElementById("campaignTerm");
const campaignVerification = document.getElementById("campaignVerification");
const campaignResultCount = document.getElementById("campaignResultCount");
const verifiedCount = document.getElementById("verifiedCount");
const exchangeCount = document.getElementById("exchangeCount");
const updatedAt = document.getElementById("updatedAt");
const wealthDataFreshness = document.getElementById("wealthDataFreshness");
const wealthMonitorNotice = document.getElementById("wealthMonitorNotice");
const wealthMonitorCopy = document.getElementById("wealthMonitorCopy");
const refreshCampaignsButton = document.getElementById("refreshCampaigns");
const summaryCampaignCount = document.getElementById("summaryCampaignCount");
const summaryTopApy = document.getElementById("summaryTopApy");
const summaryTopApyNote = document.getElementById("summaryTopApyNote");
const summarySourceHealth = document.getElementById("summarySourceHealth");
const summaryMonitorTime = document.getElementById("summaryMonitorTime");
const summaryChangedCount = document.getElementById("summaryChangedCount");
const campaignDetailDialog = document.getElementById("campaignDetailDialog");
const campaignDetailClose = document.getElementById("campaignDetailClose");
const campaignDetailLogo = document.getElementById("campaignDetailLogo");
const campaignDetailExchange = document.getElementById("campaignDetailExchange");
const campaignDetailTitle = document.getElementById("campaignDetailTitle");
const campaignDetailContent = document.getElementById("campaignDetailContent");

const state = {
  data: null,
  exchange: "all",
  query: "",
  sort: "verified",
  audience: "all",
  term: "all",
  verification: "all",
  fetchedAt: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

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
  const timestamp = Date.parse(String(value || "").replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+\(UTC\+8\)$/, "$1T$2:00+08:00"));
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function relativeTime(value, noun = "维护") {
  const timestamp = Date.parse(value || "");
  if (Number.isNaN(timestamp)) return `尚未记录${noun}时间`;
  const ageMs = Math.max(0, Date.now() - timestamp);
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 1) return `刚刚${noun}`;
  if (hours < 24) return `${hours} 小时前${noun}`;
  return `${Math.floor(hours / 24)} 天前${noun}`;
}

function getDatasetFreshness(value) {
  const normalized = String(value || "").replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+\(UTC\+8\)$/, "$1T$2:00+08:00");
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) return { stale: true, label: "尚未记录维护时间", detail: "请回到官方来源核验" };
  const stale = Date.now() - timestamp > STALE_AFTER_MS;
  return {
    stale,
    label: `${relativeTime(normalized)}${stale ? " · 需要复核" : ""}`,
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
  if (!Number.isFinite(timestamp)) return item.endTime || "长期活动";
  const remainingDays = Math.ceil((timestamp - Date.now()) / DAY_MS);
  if (remainingDays <= 1) return "即将结束";
  return `剩余 ${remainingDays} 天`;
}

function formatCampaignEndTime(item) {
  const timestamp = getDateTimestamp(item.endAt);
  if (!Number.isFinite(timestamp)) return item.endTime || "长期";
  return `${new Date(timestamp).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} 北京时间`;
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
  if (!Number.isFinite(timestamp)) return { label: "尚未记录核验时间", stale: true, timestamp: 0 };
  const stale = Date.now() - timestamp > STALE_AFTER_MS;
  const date = new Date(timestamp).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  return { label: stale ? `核验于 ${date} · 建议复核` : `核验于 ${date}`, stale, timestamp };
}

async function fetchCampaigns() {
  const endpoints = ["/api/cex-yields", "../data/cex-yields.json"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (response.ok) return response.json();
    } catch {
      // Static fallback keeps local previews usable when Functions are unavailable.
    }
  }
  throw new Error("无法加载交易所理财数据");
}

function renderExchangeFilters(data) {
  const exchanges = Array.isArray(data.exchanges) ? data.exchanges : [];
  const filters = [{ name: "all", label: "全部", logo: "" }, ...exchanges.map((item) => ({ name: item.name, label: item.shortName || item.name, logo: item.logo }))];
  exchangeFilters.innerHTML = filters.map((filter) => `
    <button class="exchange-filter${filter.name === state.exchange ? " active" : ""}" type="button" data-exchange="${escapeHtml(filter.name)}" aria-pressed="${filter.name === state.exchange}">
      ${filter.logo ? `<img src="${escapeHtml(filter.logo)}" alt="" width="18" height="18" />` : ""}${escapeHtml(filter.label)}
    </button>`).join("");
}

function filteredCampaigns() {
  const campaigns = Array.isArray(state.data?.campaigns) ? state.data.campaigns : [];
  const query = state.query.trim().toLowerCase();
  const visible = campaigns.filter((item) => {
    const verification = getVerificationMeta(item);
    const matchesExchange = state.exchange === "all" || item.exchange === state.exchange;
    const matchesQuery = !query || `${item.activity} ${item.venue} ${item.exchange} ${item.eligibility || ""} ${item.cap || ""}`.toLowerCase().includes(query);
    const matchesAudience = state.audience === "all" || (state.audience === "new" && /新用户/.test(item.eligibility || item.activity));
    const matchesTerm = state.term === "all" || String(item.productType || "").toLowerCase() === state.term;
    const matchesVerification = state.verification === "all" || (state.verification === "stale" ? verification.stale : !verification.stale);
    return matchesExchange && matchesQuery && matchesAudience && matchesTerm && matchesVerification && !isExpired(item);
  });

  return visible.sort((a, b) => {
    if (state.sort === "apy") return Number(b.apyValue || 0) - Number(a.apyValue || 0);
    if (state.sort === "deadline") return getDateTimestamp(a.endAt) - getDateTimestamp(b.endAt);
    return getVerificationMeta(b).timestamp - getVerificationMeta(a).timestamp || getDateTimestamp(a.endAt) - getDateTimestamp(b.endAt);
  });
}

function renderCampaigns() {
  const campaigns = filteredCampaigns();
  campaignEmpty.hidden = campaigns.length > 0;
  campaignResultCount.textContent = `当前显示 ${campaigns.length} 条 · 点击查看门槛、试算和官方来源`;
  if (!campaigns.length) {
    campaignBody.innerHTML = "";
    return;
  }

  campaignBody.innerHTML = campaigns.map((item) => {
    const meta = getActivityMeta(item.exchange);
    const status = getActivityStatus(item);
    const verification = getVerificationMeta(item);
    const activityContent = `<span class="activity-title-line"><strong>${escapeHtml(item.activity)}</strong><span class="campaign-status ${status.className}">${status.label}</span></span><small>${escapeHtml(item.venue)}</small><small class="verification-label${verification.stale ? " stale" : ""}">${escapeHtml(verification.label)} · 查看详情</small>`;
    return `
      <tr class="campaign-row${verification.stale ? " is-stale" : ""}" data-campaign-id="${escapeHtml(item.id)}" tabindex="0" aria-label="查看 ${escapeHtml(item.activity)} 详情">
        <td data-label="活动"><div class="activity-cell">${renderExchangeLogo(meta)}<span class="activity-link">${activityContent}</span></div></td>
        <td data-label="参考年化"><strong class="apy-value">${escapeHtml(item.apy)}</strong><small class="apy-caption">非保证收益</small></td>
        <td data-label="参与门槛"><div class="campaign-requirement"><strong>${escapeHtml(item.cap || "以账户页面为准")}</strong><small>${escapeHtml(item.eligibility || "以官方资格为准")}</small></div></td>
        <td data-label="截止时间"><div class="deadline-cell"><strong>${escapeHtml(formatCampaignEndTime(item))}</strong><small>${escapeHtml(getRemainingLabel(item))}</small></div></td>
      </tr>`;
  }).join("");
}

function riskNotes(item, verification) {
  const notes = [];
  if (verification.stale) notes.push("该记录已超过 72 小时未重新核验。");
  if (Number(item.apyValue || 0) >= 20) notes.push("高年化常伴随小额度、新用户或短期限制。");
  if (/新用户/.test(item.eligibility || item.activity)) notes.push("只有符合新用户或地区条件的账户可参与。");
  if (item.cap) notes.push("展示年化可能只适用于限额内本金。");
  if (String(item.productType || "").toLowerCase() === "fixed") notes.push("定期产品需核对提前赎回和资金锁定规则。");
  return notes.length ? notes : ["利率、额度、地区资格和可用性可能随时变化。"];
}

function openCampaignDetail(item) {
  if (!item || !campaignDetailDialog) return;
  const meta = getActivityMeta(item.exchange);
  const verification = getVerificationMeta(item);
  const notes = riskNotes(item, verification);
  campaignDetailLogo.innerHTML = renderExchangeLogo(meta, "campaign-detail-logo");
  campaignDetailExchange.textContent = `${meta.shortName || meta.name} · ${item.venue || "理财活动"}`;
  campaignDetailTitle.textContent = item.activity;
  campaignDetailContent.innerHTML = `
    <div class="campaign-detail-rate${verification.stale ? " is-stale" : ""}"><span>展示年化（不等于保证收益）</span><strong>${escapeHtml(item.apy)}</strong><small>${escapeHtml(verification.label)}</small></div>
    <dl class="campaign-detail-grid">
      <div><dt>截止时间</dt><dd>${escapeHtml(formatCampaignEndTime(item))}</dd></div>
      <div><dt>产品期限</dt><dd>${escapeHtml(item.productType || "以活动页面为准")}</dd></div>
      <div><dt>参与资格</dt><dd>${escapeHtml(item.eligibility || "以账户页面为准")}</dd></div>
      <div><dt>参考额度</dt><dd>${escapeHtml(item.cap || "以账户页面为准")}</dd></div>
      <div><dt>适用地区</dt><dd>${escapeHtml(item.region || "以账户页面为准")}</dd></div>
      <div><dt>数据来源</dt><dd>人工核验的官方规则页</dd></div>
    </dl>
    <section class="yield-estimator" data-apy="${Number(item.apyValue || 0)}">
      <div><strong>收益试算</strong><small>单利估算，未计手续费、分层额度与奖励波动</small></div>
      <div class="yield-estimator-fields"><label>本金（USD）<input id="campaignPrincipal" type="number" min="1" step="100" value="10000" /></label><label>持有天数<select id="campaignDays"><option value="7">7 天</option><option value="30" selected>30 天</option><option value="90">90 天</option><option value="365">365 天</option></select></label></div>
      <output id="campaignEstimateValue">—</output>
    </section>
    <div class="campaign-detail-note"><strong>参与前核验</strong><ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></div>
    ${item.sourceUrl ? `<a class="campaign-source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">打开官方活动页 <span aria-hidden="true">↗</span></a>` : ""}`;
  updateEstimate();
  if (!campaignDetailDialog.open) campaignDetailDialog.showModal();
}

function updateEstimate() {
  const estimator = campaignDetailContent?.querySelector(".yield-estimator");
  const principal = Number(document.getElementById("campaignPrincipal")?.value || 0);
  const days = Number(document.getElementById("campaignDays")?.value || 0);
  const apy = Number(estimator?.dataset.apy || 0);
  const result = principal * (apy / 100) * (days / 365);
  const output = document.getElementById("campaignEstimateValue");
  if (output) output.textContent = `预计税前收益 $${result.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderMonitorSummary(data) {
  const monitor = data.monitor;
  if (!monitor?.checkedAt || !Array.isArray(monitor.exchanges)) {
    summarySourceHealth.textContent = "—";
    summaryChangedCount.textContent = "—";
    summaryMonitorTime.textContent = "尚无监控记录";
    wealthMonitorCopy.textContent = "页面会读取站内最新数据；利率变化仍需人工回到官方页面核对。";
    return;
  }
  const reachable = monitor.exchanges.filter((item) => item.reachable).length;
  const changed = Number(monitor.changedCount || 0);
  summarySourceHealth.textContent = `${reachable}/${monitor.exchanges.length}`;
  summaryChangedCount.textContent = String(changed);
  summaryMonitorTime.textContent = relativeTime(monitor.checkedAt, "检查");
  wealthMonitorNotice.classList.toggle("has-changes", changed > 0);
  wealthMonitorCopy.textContent = changed > 0
    ? `官方源最近检查于 ${formatUpdatedAt(monitor.checkedAt)}，发现 ${changed} 个页面有变化。展示利率已标记为需要人工复核，不会自动改写。`
    : `官方源最近检查于 ${formatUpdatedAt(monitor.checkedAt)}，${reachable} 个来源可达，未发现页面变化。`;
}

function renderSummary(data) {
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const exchanges = Array.isArray(data.exchanges) ? data.exchanges : [];
  const active = campaigns.filter((item) => !isExpired(item));
  const top = active.reduce((best, item) => Number(item.apyValue || 0) > Number(best?.apyValue || -1) ? item : best, null);
  verifiedCount.textContent = String(active.length);
  exchangeCount.textContent = String(exchanges.length || 5);
  updatedAt.textContent = formatUpdatedAt(data.updatedAt);
  summaryCampaignCount.textContent = String(active.length);
  summaryTopApy.textContent = top?.apy || "—";
  summaryTopApyNote.textContent = top ? (top.eligibility || "非保证收益") : "暂无可见活动";
  campaignDisclaimer.textContent = data.notice || "数据仅供研究，不构成投资建议。";
  campaignSource.textContent = data.source === "kv" ? "数据层：站内人工核验记录 · 点击活动打开官方来源" : "数据层：站点默认记录";
  renderDatasetFreshness(data.updatedAt);
  renderMonitorSummary(data);
}

function render() {
  if (!state.data) return;
  renderExchangeFilters(state.data);
  renderSummary(state.data);
  renderCampaigns();
}

async function refreshCampaignData(manual = false) {
  if (manual) {
    refreshCampaignsButton.disabled = true;
    refreshCampaignsButton.textContent = "刷新中…";
  }
  try {
    state.data = await fetchCampaigns();
    state.fetchedAt = Date.now();
    render();
    if (manual) refreshCampaignsButton.textContent = "已刷新";
  } catch (error) {
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
    campaignDisclaimer.textContent = "数据加载失败，请稍后重试。";
    if (manual) refreshCampaignsButton.textContent = "刷新失败";
  } finally {
    if (manual) setTimeout(() => { refreshCampaignsButton.disabled = false; refreshCampaignsButton.textContent = "立即刷新"; }, 1200);
  }
}

exchangeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-exchange]");
  if (!button) return;
  state.exchange = button.dataset.exchange || "all";
  render();
});

campaignBody.addEventListener("click", (event) => {
  const row = event.target.closest("[data-campaign-id]");
  if (row) openCampaignDetail(state.data?.campaigns?.find((item) => item.id === row.dataset.campaignId));
});

campaignBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-campaign-id]");
  if (!row) return;
  event.preventDefault();
  openCampaignDetail(state.data?.campaigns?.find((item) => item.id === row.dataset.campaignId));
});

campaignDetailClose?.addEventListener("click", () => campaignDetailDialog.close());
campaignDetailDialog?.addEventListener("click", (event) => { if (event.target === campaignDetailDialog) campaignDetailDialog.close(); });
campaignDetailContent?.addEventListener("input", updateEstimate);
campaignDetailContent?.addEventListener("change", updateEstimate);

campaignSearch.addEventListener("input", (event) => { state.query = event.target.value; renderCampaigns(); });
campaignSort.addEventListener("change", (event) => { state.sort = event.target.value; renderCampaigns(); });
campaignAudience.addEventListener("change", (event) => { state.audience = event.target.value; renderCampaigns(); });
campaignTerm.addEventListener("change", (event) => { state.term = event.target.value; renderCampaigns(); });
campaignVerification.addEventListener("change", (event) => { state.verification = event.target.value; renderCampaigns(); });
refreshCampaignsButton.addEventListener("click", () => refreshCampaignData(true));

function readInitialCampaigns() {
  const element = document.getElementById("campaignInitialData");
  if (!element?.textContent.trim()) return null;
  try { return JSON.parse(element.textContent); }
  catch (error) { console.warn("理财活动首屏数据无法解析。", error); return null; }
}

function applyUrlFilters() {
  const query = new URLSearchParams(window.location.search).get("q");
  if (!query) return;
  state.query = query;
  campaignSearch.value = query;
}

applyUrlFilters();
const initialCampaigns = readInitialCampaigns();
if (Array.isArray(initialCampaigns?.campaigns)) { state.data = initialCampaigns; render(); }
refreshCampaignData();
setInterval(() => refreshCampaignData(), REFRESH_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - state.fetchedAt > REFRESH_INTERVAL_MS) refreshCampaignData();
});
