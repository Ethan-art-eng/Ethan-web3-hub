const STALE_AFTER_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function getTimestamp(value) {
  if (!value) return Number.NaN;
  const normalized = String(value).replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+\(UTC\+8\)$/, "$1T$2:00+08:00");
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

export function getFreshness(value) {
  const timestamp = getTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    return { stale: true, label: "尚未记录维护时间", detail: "请回到官方来源核验" };
  }

  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
  const stale = ageMs > STALE_AFTER_MS;
  const relative = ageHours < 1 ? "刚刚维护" : ageHours < 24 ? `${ageHours} 小时前维护` : `${Math.floor(ageHours / 24)} 天前维护`;
  return {
    stale,
    label: stale ? `${relative} · 需要复核` : relative,
    detail: `最后维护 ${date}`,
  };
}

function renderAirdropCell(label, value, className = "") {
  const text = value || "待补";
  const muted = !value || ["待补", "待补充", "未公布", "待观察"].includes(text);
  return `<td data-label="${label}" class="${className || (muted ? "muted" : "")}">${escapeHtml(text)}</td>`;
}

export function renderAirdropRows(projects, year = "2026", pageSize = 10) {
  return projects
    .filter((item) => item.year === year)
    .slice(0, pageSize)
    .map((item) => {
      const doneClass = item.status === "已空投" ? " done" : "";
      const link = item.link
        ? `<a class="table-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">打开</a>`
        : '<span class="muted">待补</span>';
      return `<tr>
        <td data-label="名称"><strong>${escapeHtml(item.name)}</strong></td>
        ${renderAirdropCell("类别", item.category)}
        ${renderAirdropCell("融资", item.funding, item.funding && !["未公布", "待补充"].includes(item.funding) ? "money" : "")}
        ${renderAirdropCell("投资机构", item.investors)}
        ${renderAirdropCell("成本", item.cost)}
        ${renderAirdropCell("建议上号", item.accounts)}
        <td data-label="状态"><span class="status-pill${doneClass}">${escapeHtml(item.status || "进行中")}</span></td>
        ${renderAirdropCell("利润", item.profit, item.profit && item.profit !== "待观察" ? "profit" : "")}
        <td data-label="任务链接">${link}</td>
        ${renderAirdropCell("备注", item.note)}
      </tr>`;
    })
    .join("");
}

function isExpired(item) {
  const timestamp = getTimestamp(item.endAt);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function getCampaignStatus(item) {
  const start = getTimestamp(item.startsAt);
  const end = getTimestamp(item.endAt);
  if (Number.isFinite(start) && start > Date.now()) return { label: "待开始", className: "upcoming" };
  if (Number.isFinite(end) && end - Date.now() <= 3 * DAY_MS) return { label: "即将结束", className: "ending" };
  return { label: "进行中", className: "active" };
}

function getRemainingLabel(item) {
  const timestamp = getTimestamp(item.endAt);
  if (!Number.isFinite(timestamp)) return "以首次申购时间计算";
  const remainingDays = Math.ceil((timestamp - Date.now()) / DAY_MS);
  return remainingDays <= 1 ? "即将结束" : `剩余 ${remainingDays} 天`;
}

function getVerification(item) {
  const freshness = getFreshness(item.lastVerifiedAt);
  const timestamp = getTimestamp(item.lastVerifiedAt);
  if (!Number.isFinite(timestamp)) return { label: "尚未记录核验时间", stale: true };
  const date = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
  return { label: freshness.stale ? `上次核验 ${date} · 建议复核` : `核验于 ${date}`, stale: freshness.stale };
}

export function getVisibleCampaigns(data) {
  return (Array.isArray(data?.campaigns) ? data.campaigns : [])
    .filter((item) => item.published !== false && !isExpired(item))
    .sort((a, b) => {
      const aTime = getTimestamp(a.endAt);
      const bTime = getTimestamp(b.endAt);
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return aTime - bTime;
    });
}

export function renderExchangeFilters(exchanges) {
  const filters = [{ name: "all", label: "全部", logo: "" }, ...(exchanges || []).map((item) => ({ name: item.name, label: item.shortName || item.name, logo: item.logo }))];
  return filters.map((filter) => `<button class="exchange-filter${filter.name === "all" ? " active" : ""}" type="button" data-exchange="${escapeHtml(filter.name)}" aria-pressed="${filter.name === "all"}">
    ${filter.logo ? `<img src="${escapeHtml(filter.logo)}" alt="" width="18" height="18" />` : ""}${escapeHtml(filter.label)}
  </button>`).join("");
}

export function renderCampaignRows(data) {
  const exchanges = new Map((data.exchanges || []).map((item) => [item.name, item]));
  return getVisibleCampaigns(data).map((item) => {
    const meta = exchanges.get(item.exchange) || { name: item.exchange, shortName: item.exchange };
    const status = getCampaignStatus(item);
    const verification = getVerification(item);
    const logo = meta.logo ? `<img class="exchange-logo" src="${escapeHtml(meta.logo)}" alt="${escapeHtml(meta.name)} Logo" width="58" height="58" loading="lazy" />` : "";
    const activityContent = `<span class="activity-title-line"><strong>${escapeHtml(item.activity)}</strong><span class="campaign-status ${status.className}">${status.label}</span></span><small>${escapeHtml(item.venue)}</small><small class="verification-label${verification.stale ? " stale" : ""}">${escapeHtml(verification.label)}</small>`;
    const activity = item.sourceUrl
      ? `<a class="activity-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${activityContent}</a>`
      : `<span>${activityContent}</span>`;
    return `<tr class="campaign-row">
      <td data-label="活动"><div class="activity-cell">${logo}${activity}</div></td>
      <td data-label="年利率"><strong class="apy-value">${escapeHtml(item.apy)}</strong></td>
      <td data-label="到期时间（当地）"><div class="deadline-cell"><strong>${escapeHtml(item.endTime)}</strong><small>${escapeHtml(getRemainingLabel(item))}</small></div></td>
    </tr>`;
  }).join("");
}

export function renderInitialDataScript(data) {
  return safeJson(data);
}
