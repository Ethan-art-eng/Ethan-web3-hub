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

function cleanAirdropName(value) {
  return String(value || "未命名项目").replace(/\s*[（(]20\d{2}[）)]\s*$/, "").trim();
}

function airdropInitials(value) {
  const name = cleanAirdropName(value);
  const words = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function renderAirdropLogo(item) {
  const logoId = String(item.logoId || item.id || "").trim();
  const safeLogoId = /^[a-z0-9-]+$/i.test(logoId) ? logoId : "";
  const image = safeLogoId
    ? `<img src="../assets/airdrops/${escapeHtml(safeLogoId)}.png" alt="" loading="lazy" decoding="async">`
    : "";
  return `<span class="airdrop-project-logo" aria-hidden="true"><span>${escapeHtml(airdropInitials(item.name))}</span>${image}</span>`;
}

export function getAirdropDisplayStatus(item) {
  const missing = new Set(["", "待补", "待补充"]);
  const needsVerification = [item.category, item.cost, item.accounts].some((value) => missing.has(String(value || "").trim())) || !item.link;
  if (needsVerification) return "待核验";
  return item.status === "已空投" ? "已空投" : "进行中";
}

export function renderAirdropRows(projects, year = "2026", pageSize = 10) {
  return projects
    .filter((item) => item.year === year)
    .slice(0, pageSize)
    .map((item) => {
      const displayStatus = getAirdropDisplayStatus(item);
      const statusClass = displayStatus === "已空投" ? " done" : displayStatus === "待核验" ? " pending" : "";
      const link = item.link
        ? `<a class="table-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" data-no-detail>任务 ↗</a>`
        : '<span class="muted">待补</span>';
      return `<tr class="airdrop-project-row" data-project-id="${escapeHtml(item.id || "")}" tabindex="0">
        <td data-label="名称"><span class="project-name-identity">${renderAirdropLogo(item)}<span class="project-name-cell"><strong>${escapeHtml(cleanAirdropName(item.name))}</strong><small>查看详情</small></span></span></td>
        ${renderAirdropCell("类别", item.category)}
        ${renderAirdropCell("融资", item.funding, item.funding && !["未公布", "待补充"].includes(item.funding) ? "money" : "")}
        ${renderAirdropCell("投资机构", item.investors, "mobile-secondary")}
        ${renderAirdropCell("成本", item.cost)}
        ${renderAirdropCell("建议上号", item.accounts, "mobile-secondary")}
        <td data-label="状态"><span class="status-pill${statusClass}">${escapeHtml(displayStatus)}</span></td>
        ${renderAirdropCell("利润", item.profit, item.profit && item.profit !== "待观察" ? "profit" : "")}
        <td data-label="任务链接">${link}</td>
        ${renderAirdropCell("备注", item.note, "note-cell mobile-secondary")}
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

function getDeadlineScaleDays(campaigns) {
  const remainingDays = campaigns.map((item) => {
    const timestamp = getTimestamp(item.endAt);
    return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - Date.now()) / DAY_MS)) : 0;
  });
  return Math.max(30, ...remainingDays);
}

function getDeadlineMeta(item, scaleDays = 30) {
  const timestamp = getTimestamp(item.endAt);
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
  const timestamp = getTimestamp(item.endAt);
  if (!Number.isFinite(timestamp)) return item.endTime || "长期";
  const value = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
  return `${value} 北京时间`;
}

function renderDeadline(item, scaleDays) {
  const deadline = getDeadlineMeta(item, scaleDays);
  return `<div class="deadline-cell ${deadline.className}" aria-label="${escapeHtml(`${deadline.label}，截止 ${deadline.date}${deadline.time ? ` ${deadline.time}` : ""}`)}">
    <span class="deadline-status">${escapeHtml(deadline.label)}</span>
    <time${item.endAt ? ` datetime="${escapeHtml(item.endAt)}"` : ""}><strong>${escapeHtml(deadline.date)}</strong>${deadline.time ? `<small>${escapeHtml(deadline.time)}</small>` : ""}</time>
    ${deadline.finite ? `<progress class="deadline-track" max="${Math.max(1, scaleDays)}" value="${Math.min(Math.max(1, scaleDays), deadline.remainingValue).toFixed(2)}" aria-hidden="true"></progress>` : ""}
  </div>`;
}

function getVerification(item) {
  const freshness = getFreshness(item.lastVerifiedAt);
  const timestamp = getTimestamp(item.lastVerifiedAt);
  if (!Number.isFinite(timestamp)) return { label: "尚未记录核验时间", stale: true };
  const date = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
  const verb = item.dataOrigin === "barker" ? "数据更新于" : "核验于";
  return { label: freshness.stale ? `${verb} ${date} · 建议复核` : `${verb} ${date}`, stale: freshness.stale };
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
  const campaigns = getVisibleCampaigns(data);
  const deadlineScaleDays = getDeadlineScaleDays(campaigns);
  return campaigns.map((item) => {
    const meta = exchanges.get(item.exchange) || { name: item.exchange, shortName: item.exchange };
    const status = getCampaignStatus(item);
    const verification = getVerification(item);
    const logo = meta.logo
      ? `<img class="exchange-logo" src="${escapeHtml(meta.logo)}" alt="${escapeHtml(meta.name)} Logo" width="58" height="58" loading="lazy" />`
      : `<span class="exchange-logo exchange-monogram" aria-hidden="true">${escapeHtml((meta.shortName || meta.name || "?").slice(0, 1))}</span>`;
    const activityContent = `<span class="activity-title-line"><strong>${escapeHtml(item.activity)}</strong><span class="campaign-status ${status.className}">${status.label}</span></span><small>${escapeHtml(item.venue)}</small><small class="verification-label${verification.stale ? " stale" : ""}">${escapeHtml(verification.label)}</small>`;
    const activity = item.sourceUrl
      ? `<a class="activity-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${activityContent}</a>`
      : `<span>${activityContent}</span>`;
    return `<tr class="campaign-row" data-campaign-id="${escapeHtml(item.id || "")}" tabindex="0" aria-label="查看 ${escapeHtml(item.activity)} 详情">
      <td data-label="活动"><div class="activity-cell">${logo}${activity}</div></td>
      <td data-label="参考年化"><strong class="apy-value">${escapeHtml(item.apy)}</strong></td>
      <td data-label="截止时间">${renderDeadline(item, deadlineScaleDays)}</td>
    </tr>`;
  }).join("");
}

export function renderInitialDataScript(data) {
  return safeJson(data);
}
