const campaignBody = document.getElementById("campaignTableBody");
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
const DEADLINE_RENDER_INTERVAL_MS = 60 * 1000;

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
  if (!meta.logo) return `<span class="${className} exchange-monogram" aria-hidden="true">${escapeHtml((meta.shortName || meta.name || "?").slice(0, 1))}</span>`;
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

function getDeadlineScaleDays(campaigns) {
  const remainingDays = campaigns.map((item) => {
    const timestamp = getDateTimestamp(item.endAt);
    return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - Date.now()) / DAY_MS)) : 0;
  });
  return Math.max(30, ...remainingDays);
}

function getDeadlineMeta(item, scaleDays = 30) {
  const timestamp = getDateTimestamp(item.endAt);
  if (!Number.isFinite(timestamp)) {
    return { label: "长期开放", date: "无固定截止日", time: "", progress: 100, className: "ongoing", finite: false };
  }
  const now = Date.now();
  const remainingDays = Math.max(0, Math.ceil((timestamp - now) / DAY_MS));
  const remainingValue = Math.max(0, (timestamp - now) / DAY_MS);
  const progress = Math.max(4, Math.min(100, (remainingValue / Math.max(1, scaleDays)) * 100));
  const dateParts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp)).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const currentYear = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric" }).format(new Date(now)).replace(/\D/g, "");
  const date = dateParts.year === currentYear ? `${Number(dateParts.month)}月${Number(dateParts.day)}日` : `${dateParts.year}年${Number(dateParts.month)}月${Number(dateParts.day)}日`;
  const time = `${dateParts.hour}:${dateParts.minute}`;
  if (remainingDays <= 1) return { label: "今天截止", date, time, progress, remainingValue, className: "ending", finite: true };
  if (remainingDays <= 7) return { label: `剩余 ${remainingDays} 天`, date, time, progress, remainingValue, className: "soon", finite: true };
  return { label: `剩余 ${remainingDays} 天`, date, time, progress, remainingValue, className: "scheduled", finite: true };
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

function renderDeadline(item, scaleDays) {
  const deadline = getDeadlineMeta(item, scaleDays);
  return `<div class="deadline-cell ${deadline.className}" aria-label="${escapeHtml(`${deadline.label}，截止 ${deadline.date}${deadline.time ? ` ${deadline.time}` : ""}`)}">
    <span class="deadline-status">${escapeHtml(deadline.label)}</span>
    <time${item.endAt ? ` datetime="${escapeHtml(item.endAt)}"` : ""}><strong>${escapeHtml(deadline.date)}</strong>${deadline.time ? `<small>${escapeHtml(deadline.time)}</small>` : ""}</time>
    ${deadline.finite ? `<progress class="deadline-track" max="${Math.max(1, scaleDays)}" value="${Math.min(Math.max(1, scaleDays), deadline.remainingValue).toFixed(2)}" aria-hidden="true"></progress>` : ""}
  </div>`;
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
  const verb = item.dataOrigin === "barker" ? "数据更新于" : "核验于";
  return { label: stale ? `${verb} ${date} · 建议复核` : `${verb} ${date}`, stale, timestamp };
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
      ${filter.logo ? `<img src="${escapeHtml(filter.logo)}" alt="" width="18" height="18" />` : filter.name !== "all" ? `<span class="exchange-filter-monogram" aria-hidden="true">${escapeHtml(filter.label.slice(0, 1))}</span>` : ""}${escapeHtml(filter.label)}
    </button>`).join("");
}

function filteredCampaigns() {
  const campaigns = Array.isArray(state.data?.campaigns) ? state.data.campaigns : [];
  const query = state.query.trim().toLowerCase();
  const visible = campaigns.filter((item) => {
    const verification = getVerificationMeta(item);
    const matchesExchange = state.exchange === "all" || item.exchange === state.exchange;
    const matchesQuery = !query || `${item.activity} ${item.venue} ${item.exchange} ${item.rewardAsset || ""} ${item.eligibility || ""} ${item.cap || ""}`.toLowerCase().includes(query);
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
  const deadlineScaleDays = getDeadlineScaleDays(campaigns);
  campaignEmpty.hidden = campaigns.length > 0;
  campaignResultCount.textContent = `当前显示 ${campaigns.length} 条主站活动 · 点击查看详情、试算和来源`;
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
        <td data-label="参考年化"><strong class="apy-value">${escapeHtml(item.apy)}</strong></td>
        <td data-label="截止时间">${renderDeadline(item, deadlineScaleDays)}</td>
      </tr>`;
  }).join("");
}

function apyBreakdown(item) {
  const parts = [];
  if (item.baseApyValue !== null && item.baseApyValue !== undefined && Number.isFinite(Number(item.baseApyValue))) parts.push(`<div><dt>基础 APY</dt><dd>${Number(item.baseApyValue).toFixed(2)}%</dd></div>`);
  if (item.rewardApyValue !== null && item.rewardApyValue !== undefined && Number.isFinite(Number(item.rewardApyValue))) parts.push(`<div><dt>奖励 APY</dt><dd>${Number(item.rewardApyValue).toFixed(2)}%</dd></div>`);
  if (item.rewardAsset) parts.push(`<div><dt>奖励资产</dt><dd>${escapeHtml(item.rewardAsset)}</dd></div>`);
  if (item.rewardFrequency) parts.push(`<div><dt>奖励频率</dt><dd>${escapeHtml(item.rewardFrequency)}</dd></div>`);
  return parts.join("");
}

function tierDetails(item) {
  if (!Array.isArray(item.tierDetails) || !item.tierDetails.length) return "";
  const rows = item.tierDetails.map((tier) => {
    const minimum = Number(tier.min || 0).toLocaleString("en-US");
    const maximum = Number.isFinite(Number(tier.max)) && Number(tier.max) > 0 ? `$${Number(tier.max).toLocaleString("en-US")}` : "以上";
    return `<li><span>$${minimum} – ${maximum}</span><strong>${Number(tier.apyValue).toFixed(2)}%</strong></li>`;
  }).join("");
  return `<section class="campaign-tier-details"><strong>分层年化</strong><ul>${rows}</ul></section>`;
}

function openCampaignDetail(item) {
  if (!item || !campaignDetailDialog) return;
  const meta = getActivityMeta(item.exchange);
  const verification = getVerificationMeta(item);
  campaignDetailLogo.innerHTML = renderExchangeLogo(meta, "campaign-detail-logo");
  campaignDetailExchange.textContent = `${meta.shortName || meta.name} · ${item.venue || "理财活动"}`;
  campaignDetailTitle.textContent = item.activity;
  campaignDetailContent.innerHTML = `
    <div class="campaign-detail-rate${verification.stale ? " is-stale" : ""}"><span>当前展示年化</span><strong>${escapeHtml(item.apy)}</strong><small>${escapeHtml(verification.label)}</small></div>
    <dl class="campaign-detail-grid">
      <div><dt>截止时间</dt><dd>${escapeHtml(formatCampaignEndTime(item))}</dd></div>
      <div><dt>产品期限</dt><dd>${escapeHtml(item.productType || "以活动页面为准")}</dd></div>
      <div><dt>参与资格</dt><dd>${escapeHtml(item.eligibility || "以账户页面为准")}</dd></div>
      <div><dt>参考额度</dt><dd>${escapeHtml(item.cap || "以账户页面为准")}</dd></div>
      <div><dt>适用地区</dt><dd>${escapeHtml(item.region || "以账户页面为准")}</dd></div>
      <div><dt>数据来源</dt><dd>${item.dataOrigin === "barker" ? "Barker 自动同步" : "站内人工记录"}</dd></div>
      ${apyBreakdown(item)}
    </dl>
    ${tierDetails(item)}
    <section class="yield-estimator" data-apy="${Number(item.apyValue || 0)}">
      <div><strong>收益试算</strong><small>单利估算，未计手续费、分层额度与奖励波动</small></div>
      <div class="yield-estimator-fields"><label>本金（USD）<input id="campaignPrincipal" type="number" min="1" step="100" value="10000" /></label><label>持有天数<select id="campaignDays"><option value="7">7 天</option><option value="30" selected>30 天</option><option value="90">90 天</option><option value="365">365 天</option></select></label></div>
      <output id="campaignEstimateValue">—</output>
    </section>
    ${item.sourceUrl ? `<a class="campaign-source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${item.sourceType === "official" ? "打开交易所官方页面" : "查看 Barker 活动详情"} <span aria-hidden="true">↗</span></a>` : ""}
    ${item.sourceType === "official" && item.providerUrl ? `<a class="campaign-provider-link" href="${escapeHtml(item.providerUrl)}" target="_blank" rel="noopener noreferrer">查看 Barker 数据页 ↗</a>` : ""}`;
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
  const sync = data.sync;
  if (sync?.provider) {
    const healthy = sync.status !== "error";
    wealthMonitorNotice.classList.toggle("has-changes", !healthy);
    wealthMonitorCopy.textContent = healthy
      ? `最近同步于 ${formatUpdatedAt(sync.syncedAt)}，当前收录 ${Number(sync.campaignCount || data.campaigns?.length || 0)} 个交易所活动；页面每 5 分钟读取一次。`
      : `最近一次同步未完成，当前继续展示 ${formatUpdatedAt(sync.syncedAt)} 保存的活动数据，不会清空列表。`;
    return;
  }
  const monitor = data.monitor;
  if (!monitor?.checkedAt || !Array.isArray(monitor.exchanges)) {
    wealthMonitorCopy.textContent = "页面会读取站内最新数据；利率变化仍需人工回到官方页面核对。";
    return;
  }
  const reachable = monitor.exchanges.filter((item) => item.reachable).length;
  const changed = Number(monitor.changedCount || 0);
  wealthMonitorNotice.classList.toggle("has-changes", changed > 0);
  wealthMonitorCopy.textContent = changed > 0
    ? `官方源最近检查于 ${formatUpdatedAt(monitor.checkedAt)}，发现 ${changed} 个页面有变化。展示利率已标记为需要人工复核，不会自动改写。`
    : `官方源最近检查于 ${formatUpdatedAt(monitor.checkedAt)}，${reachable} 个来源可达，未发现页面变化。`;
}

function renderSummary(data) {
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const exchanges = Array.isArray(data.exchanges) ? data.exchanges : [];
  const active = campaigns.filter((item) => !isExpired(item));
  verifiedCount.textContent = String(active.length);
  exchangeCount.textContent = String(exchanges.length || 5);
  updatedAt.textContent = formatUpdatedAt(data.updatedAt);
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
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="3">${escapeHtml(error.message)}</td></tr>`;
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
setInterval(() => { if (state.data) renderCampaigns(); }, DEADLINE_RENDER_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - state.fetchedAt > REFRESH_INTERVAL_MS) refreshCampaignData();
});
