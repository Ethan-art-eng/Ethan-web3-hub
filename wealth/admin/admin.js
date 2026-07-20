const API_URL = "/wealth/admin/api/cex-yields";
const TOKEN_KEY = "ethan_wealth_admin_token";
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const adminToken = document.getElementById("adminToken");
const loginStatus = document.getElementById("loginStatus");
const adminWorkspace = document.getElementById("adminWorkspace");
const disconnectButton = document.getElementById("disconnectButton");
const adminCampaignBody = document.getElementById("adminCampaignBody");
const adminEmpty = document.getElementById("adminEmpty");
const adminCampaignCount = document.getElementById("adminCampaignCount");
const adminPublishedCount = document.getElementById("adminPublishedCount");
const adminDraftCount = document.getElementById("adminDraftCount");
const adminUpdatedAt = document.getElementById("adminUpdatedAt");
const adminStatusFilter = document.getElementById("adminStatusFilter");
const noticeInput = document.getElementById("noticeInput");
const saveNoticeButton = document.getElementById("saveNoticeButton");
const saveStatus = document.getElementById("saveStatus");
const addCampaignButton = document.getElementById("addCampaignButton");
const campaignDialog = document.getElementById("campaignDialog");
const campaignForm = document.getElementById("campaignForm");
const dialogTitle = document.getElementById("dialogTitle");
const campaignExchange = document.getElementById("campaignExchange");
const campaignActivity = document.getElementById("campaignActivity");
const campaignVenue = document.getElementById("campaignVenue");
const campaignProductType = document.getElementById("campaignProductType");
const campaignEligibility = document.getElementById("campaignEligibility");
const campaignRegion = document.getElementById("campaignRegion");
const campaignCap = document.getElementById("campaignCap");
const campaignApy = document.getElementById("campaignApy");
const campaignApyValue = document.getElementById("campaignApyValue");
const campaignStartsAt = document.getElementById("campaignStartsAt");
const campaignEndTime = document.getElementById("campaignEndTime");
const campaignEndAt = document.getElementById("campaignEndAt");
const campaignLastVerifiedAt = document.getElementById("campaignLastVerifiedAt");
const campaignSourceUrl = document.getElementById("campaignSourceUrl");
const campaignPublished = document.getElementById("campaignPublished");
const historyButton = document.getElementById("historyButton");
const historyDialog = document.getElementById("historyDialog");
const historyList = document.getElementById("historyList");
const historyStatus = document.getElementById("historyStatus");
const monitorSummary = document.getElementById("monitorSummary");
const monitorGrid = document.getElementById("monitorGrid");
const monitorStatus = document.getElementById("monitorStatus");
const runMonitorButton = document.getElementById("runMonitorButton");

const state = { data: null, editingId: null, statusFilter: "all" };

function selectPanel(name) {
  document.querySelectorAll("[data-admin-panel]").forEach((button) => button.classList.toggle("active", button.dataset.adminPanel === name));
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function token() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function setStatus(element, message, type = "") {
  const baseClass = element === saveStatus ? "save-status" : "form-status";
  element.textContent = message;
  element.className = `${baseClass}${type ? ` status-${type}` : ""}`;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload;
}

window.adminConsole = { apiRequest, escapeHtml, setStatus, selectPanel, getToken: token };

function normalizeCampaign(item, fallbackDate) {
  return {
    ...item,
    productType: item.productType || "",
    eligibility: item.eligibility || "",
    region: item.region || "",
    cap: item.cap || "",
    published: item.published !== false,
    startsAt: item.startsAt || null,
    endAt: item.endAt || null,
    lastVerifiedAt: item.lastVerifiedAt || fallbackDate || new Date().toISOString(),
  };
}

function normalizeData(data) {
  return {
    ...data,
    campaigns: (data.campaigns || []).map((item) => normalizeCampaign(item, data.updatedAt)),
  };
}

function getExchange(name) {
  return state.data.exchanges.find((item) => item.name === name) || { name, shortName: name, logo: "" };
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isStale(item) {
  const verifiedAt = Date.parse(item.lastVerifiedAt || "");
  return Number.isNaN(verifiedAt) || Date.now() - verifiedAt > STALE_AFTER_MS;
}

function getCampaignStatus(item) {
  if (!item.published) return { label: "草稿", className: "draft" };
  const now = Date.now();
  const start = Date.parse(item.startsAt || "");
  const end = Date.parse(item.endAt || "");
  if (!Number.isNaN(start) && start > now) return { label: "待开始", className: "upcoming" };
  if (!Number.isNaN(end) && end < now) return { label: "已结束", className: "ended" };
  if (!Number.isNaN(end) && end - now <= 3 * 24 * 60 * 60 * 1000) return { label: "即将结束", className: "ending" };
  return { label: "已发布", className: "published" };
}

function filteredCampaigns(campaigns) {
  if (state.statusFilter === "published") return campaigns.filter((item) => item.published);
  if (state.statusFilter === "draft") return campaigns.filter((item) => !item.published);
  if (state.statusFilter === "stale") return campaigns.filter(isStale);
  return campaigns;
}

function render() {
  const campaigns = state.data.campaigns || [];
  const visible = filteredCampaigns(campaigns);
  adminCampaignCount.textContent = String(campaigns.length);
  adminPublishedCount.textContent = String(campaigns.filter((item) => item.published).length);
  adminDraftCount.textContent = String(campaigns.filter((item) => !item.published).length);
  adminUpdatedAt.textContent = String(state.data.updatedAt || "—").replace("T", " ").slice(0, 16);
  document.getElementById("overviewWealthCount").textContent = String(campaigns.length);
  noticeInput.value = state.data.notice || "";
  adminEmpty.hidden = visible.length > 0;
  adminEmpty.textContent = campaigns.length ? "该筛选条件下没有活动。" : "暂时没有活动，点击“新增活动”开始录入。";
  campaignExchange.innerHTML = state.data.exchanges.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.shortName)} ${escapeHtml(item.name)}</option>`).join("");

  adminCampaignBody.innerHTML = visible.map((item) => {
    const exchange = getExchange(item.exchange);
    const status = getCampaignStatus(item);
    const verification = isStale(item) ? "需要复核" : `核验 ${new Date(item.lastVerifiedAt).toLocaleDateString("zh-CN")}`;
    return `<tr>
      <td><div class="campaign-name"><img src="${escapeHtml(exchange.logo)}" alt="${escapeHtml(exchange.name)} Logo" /><span><span class="admin-title-line"><strong>${escapeHtml(item.activity)}</strong><em class="admin-badge ${status.className}">${status.label}</em>${isStale(item) ? '<em class="admin-badge stale">需复核</em>' : ""}</span><small>${escapeHtml(item.venue)} · ${escapeHtml(verification)}</small></span></div></td>
      <td><strong>${escapeHtml(item.apy)}</strong></td>
      <td>${escapeHtml(item.endTime)}</td>
      <td><div class="row-actions"><button type="button" data-verify="${escapeHtml(item.id)}">已核验</button><button type="button" data-edit="${escapeHtml(item.id)}">编辑</button><button class="delete-button" type="button" data-delete="${escapeHtml(item.id)}">删除</button></div></td>
    </tr>`;
  }).join("");
}

function renderMonitor(report) {
  const exchanges = report.exchanges || [];
  if (!report.checkedAt || !exchanges.length) {
    monitorSummary.textContent = "尚未执行检查。点击“立即检查”建立第一份页面指纹。";
    monitorGrid.innerHTML = state.data.exchanges.map((item) => `<article class="monitor-item"><img src="${escapeHtml(item.logo)}" alt="${escapeHtml(item.name)} Logo" /><span><strong>${escapeHtml(item.shortName)}</strong><small>等待首次检查</small></span><em class="monitor-badge pending">未检查</em></article>`).join("");
    return;
  }

  const checkedAt = new Date(report.checkedAt).toLocaleString("zh-CN", { hour12: false });
  monitorSummary.textContent = `最近检查：${checkedAt} · ${report.changedCount || 0} 个页面有变化 · ${report.issueCount || 0} 个访问异常 · ${report.blockedCount || 0} 个访问受限`;
  monitorGrid.innerHTML = exchanges.map((item) => {
    const exchange = getExchange(item.name);
    const status = item.blocked ? { label: "访问受限", className: "blocked" } : !item.reachable ? { label: "访问异常", className: "issue" } : item.changed ? { label: "页面有变化", className: "changed" } : { label: "未发现变化", className: "healthy" };
    return `<article class="monitor-item"><img src="${escapeHtml(exchange.logo)}" alt="${escapeHtml(exchange.name)} Logo" /><span><strong>${escapeHtml(exchange.shortName)}</strong><small>${item.reachable ? `HTTP ${item.status}` : escapeHtml(item.error || "无法访问")}</small></span><em class="monitor-badge ${status.className}">${status.label}</em><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开官方页</a></article>`;
  }).join("");
}

async function loadMonitor() {
  try {
    renderMonitor(await apiRequest(`${API_URL}?monitor=1`));
    setStatus(monitorStatus, "");
  } catch (error) {
    setStatus(monitorStatus, error.message, "error");
  }
}

async function connect() {
  setStatus(loginStatus, "正在验证并读取数据…");
  try {
    state.data = normalizeData(await apiRequest(`${API_URL}?admin=1`));
    loginPanel.hidden = true;
    adminWorkspace.hidden = false;
    disconnectButton.hidden = false;
    render();
    loadMonitor();
    setStatus(loginStatus, "");
    window.dispatchEvent(new CustomEvent("admin:connected"));
  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);
    setStatus(loginStatus, error.message === "Unauthorized" ? "当前邮箱没有管理权限，或备用令牌不正确。" : error.message, "error");
  }
}

async function persist(message) {
  setStatus(saveStatus, "正在保存…");
  const result = await apiRequest(API_URL, { method: "PUT", body: JSON.stringify(state.data) });
  state.data = normalizeData(result.data);
  render();
  setStatus(saveStatus, message, "success");
}

function openCampaignDialog(item = null) {
  state.editingId = item?.id || null;
  dialogTitle.textContent = item ? "编辑活动" : "新增活动";
  campaignForm.reset();
  campaignExchange.value = item?.exchange || state.data.exchanges[0].name;
  campaignActivity.value = item?.activity || "";
  campaignVenue.value = item?.venue || "";
  campaignProductType.value = item?.productType || "";
  campaignEligibility.value = item?.eligibility || "";
  campaignRegion.value = item?.region || "";
  campaignCap.value = item?.cap || "";
  campaignApy.value = item?.apy || "";
  campaignApyValue.value = item?.apyValue ?? "";
  campaignStartsAt.value = formatDateTimeLocal(item?.startsAt);
  campaignEndTime.value = item?.endTime || "";
  campaignEndAt.value = formatDateTimeLocal(item?.endAt);
  campaignLastVerifiedAt.value = formatDateTimeLocal(item?.lastVerifiedAt || new Date().toISOString());
  campaignSourceUrl.value = item?.sourceUrl || "";
  campaignPublished.checked = item?.published ?? false;
  campaignDialog.showModal();
}

async function loadHistory() {
  setStatus(historyStatus, "正在读取版本记录…");
  try {
    const { revisions } = await apiRequest(`${API_URL}?history=1`);
    historyList.innerHTML = revisions.length ? revisions.map((item) => `<div class="history-item"><span><strong>${escapeHtml(String(item.updatedAt).replace("T", " ").slice(0, 19))}</strong><small>${item.campaigns} 条活动</small></span><button type="button" data-restore="${escapeHtml(item.key)}">恢复此版本</button></div>`).join("") : '<p class="admin-empty">还没有可恢复的历史版本。</p>';
    setStatus(historyStatus, "");
  } catch (error) {
    setStatus(historyStatus, error.message, "error");
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sessionStorage.setItem(TOKEN_KEY, adminToken.value.trim());
  connect();
});

disconnectButton.addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  if (window.location.hostname === "ethanweb3.com") {
    window.location.assign("/cdn-cgi/access/logout");
    return;
  }
  state.data = null;
  adminWorkspace.hidden = true;
  disconnectButton.hidden = true;
  loginPanel.hidden = false;
  adminToken.value = "";
});

document.querySelector(".admin-nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-admin-panel]");
  if (button) selectPanel(button.dataset.adminPanel);
});

document.querySelector("[data-panel='overview']").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-jump-panel]");
  if (button) selectPanel(button.dataset.jumpPanel);
});

adminStatusFilter.addEventListener("change", (event) => {
  state.statusFilter = event.target.value;
  render();
});

addCampaignButton.addEventListener("click", () => openCampaignDialog());
document.getElementById("closeDialogButton").addEventListener("click", () => campaignDialog.close());
document.getElementById("cancelDialogButton").addEventListener("click", () => campaignDialog.close());

historyButton.addEventListener("click", () => {
  historyDialog.showModal();
  loadHistory();
});
document.getElementById("closeHistoryButton").addEventListener("click", () => historyDialog.close());

runMonitorButton.addEventListener("click", async () => {
  runMonitorButton.disabled = true;
  setStatus(monitorStatus, "正在检查五家交易所官方页面，通常需要数秒…");
  try {
    const result = await apiRequest(`${API_URL}?action=monitor`, { method: "POST" });
    renderMonitor(result.data);
    setStatus(monitorStatus, "检查完成。页面变化只作为复核提醒，不会自动发布活动。", "success");
  } catch (error) {
    setStatus(monitorStatus, error.message, "error");
  } finally {
    runMonitorButton.disabled = false;
  }
});

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previous = structuredClone(state.data.campaigns);
  const existing = state.data.campaigns.find((item) => item.id === state.editingId);
  const item = {
    id: existing?.id || `${campaignExchange.value.toLowerCase()}-${Date.now()}`,
    exchange: campaignExchange.value,
    activity: campaignActivity.value.trim(),
    venue: campaignVenue.value.trim(),
    productType: campaignProductType.value,
    eligibility: campaignEligibility.value.trim(),
    region: campaignRegion.value.trim(),
    cap: campaignCap.value.trim(),
    apy: campaignApy.value.trim(),
    apyValue: Number(campaignApyValue.value),
    published: campaignPublished.checked,
    startsAt: campaignStartsAt.value ? new Date(campaignStartsAt.value).toISOString() : null,
    endTime: campaignEndTime.value.trim(),
    endAt: campaignEndAt.value ? new Date(campaignEndAt.value).toISOString() : null,
    lastVerifiedAt: new Date(campaignLastVerifiedAt.value).toISOString(),
    sourceUrl: campaignSourceUrl.value.trim(),
  };

  if (existing) state.data.campaigns = state.data.campaigns.map((campaign) => campaign.id === existing.id ? item : campaign);
  else state.data.campaigns = [item, ...state.data.campaigns];

  campaignDialog.close();
  render();
  try {
    await persist(item.published ? "活动已保存并发布。" : "活动已保存为草稿。");
  } catch (error) {
    state.data.campaigns = previous;
    render();
    setStatus(saveStatus, error.message, "error");
  }
});

adminCampaignBody.addEventListener("click", async (event) => {
  const editButton = event.target.closest("button[data-edit]");
  if (editButton) {
    openCampaignDialog(state.data.campaigns.find((item) => item.id === editButton.dataset.edit));
    return;
  }

  const verifyButton = event.target.closest("button[data-verify]");
  if (verifyButton) {
    const previous = structuredClone(state.data.campaigns);
    state.data.campaigns = state.data.campaigns.map((item) => item.id === verifyButton.dataset.verify ? { ...item, lastVerifiedAt: new Date().toISOString() } : item);
    render();
    try {
      await persist("核验时间已更新。");
    } catch (error) {
      state.data.campaigns = previous;
      render();
      setStatus(saveStatus, error.message, "error");
    }
    return;
  }

  const deleteButton = event.target.closest("button[data-delete]");
  if (!deleteButton) return;
  const item = state.data.campaigns.find((campaign) => campaign.id === deleteButton.dataset.delete);
  if (!item || !window.confirm(`确定删除“${item.activity}”吗？保存后公开页会立即移除。`)) return;

  const previous = structuredClone(state.data.campaigns);
  state.data.campaigns = state.data.campaigns.filter((campaign) => campaign.id !== item.id);
  render();
  try {
    await persist("活动已删除。");
  } catch (error) {
    state.data.campaigns = previous;
    render();
    setStatus(saveStatus, error.message, "error");
  }
});

historyList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-restore]");
  if (!button || !window.confirm("确定恢复这个历史版本吗？当前版本也会自动备份。")) return;
  setStatus(historyStatus, "正在恢复…");
  try {
    const result = await apiRequest(`${API_URL}?action=restore&key=${encodeURIComponent(button.dataset.restore)}`, { method: "POST" });
    state.data = normalizeData(result.data);
    render();
    historyDialog.close();
    setStatus(saveStatus, "历史版本已恢复。", "success");
  } catch (error) {
    setStatus(historyStatus, error.message, "error");
  }
});

saveNoticeButton.addEventListener("click", async () => {
  const previous = state.data.notice;
  state.data.notice = noticeInput.value.trim();
  try {
    await persist("风险提示已保存。");
  } catch (error) {
    state.data.notice = previous;
    render();
    setStatus(saveStatus, error.message, "error");
  }
});

document.addEventListener("DOMContentLoaded", connect);
