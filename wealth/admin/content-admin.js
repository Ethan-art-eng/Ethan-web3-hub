const CONTENT_API = "/wealth/admin/api/site-content";
const contentState = { data: null, featuredEditingId: null, toolEditing: null, tutorialEditingId: null, query: "", group: "all" };
const FEATURED_PLATFORMS = {
  binance: "Binance",
  okx: "OKX",
  bybit: "Bybit",
  bitget: "Bitget",
  gate: "Gate",
};

const toolBody = document.getElementById("toolAdminBody");
const toolEmpty = document.getElementById("toolAdminEmpty");
const toolSaveStatus = document.getElementById("toolSaveStatus");
const toolDialog = document.getElementById("toolDialog");
const toolForm = document.getElementById("toolForm");
const tutorialDialog = document.getElementById("tutorialDialog");
const tutorialForm = document.getElementById("tutorialForm");
const featuredBody = document.getElementById("featuredAdminBody");
const featuredEmpty = document.getElementById("featuredAdminEmpty");
const featuredSaveStatus = document.getElementById("featuredSaveStatus");
const featuredDialog = document.getElementById("featuredDialog");
const featuredForm = document.getElementById("featuredForm");

function normalizeContentData(data) {
  return {
    ...data,
    featuredCampaigns: (data.featuredCampaigns || []).map((item) => ({
      ...item,
      platform: item.platform || FEATURED_PLATFORMS[item.platformKey] || item.platformKey,
      tags: Array.isArray(item.tags) ? item.tags : [],
      startsAt: item.startsAt || null,
      endAt: item.endAt || null,
      lastVerifiedAt: item.lastVerifiedAt || null,
      published: item.published !== false,
    })),
    essentials: data.essentials || [],
    toolGroups: data.toolGroups || [],
    tutorials: data.tutorials || [],
  };
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getFeaturedStatus(item) {
  if (!item.published) return { label: "草稿", className: "draft", active: false };
  const now = Date.now();
  const start = Date.parse(item.startsAt || "");
  const end = Date.parse(item.endAt || "");
  if (!Number.isNaN(start) && start > now) return { label: "待开始", className: "upcoming", active: false };
  if (!Number.isNaN(end) && end <= now) return { label: "已结束", className: "ended", active: false };
  if (!Number.isNaN(end) && end - now <= 3 * 24 * 60 * 60 * 1000) return { label: "即将结束", className: "ending", active: true };
  return { label: "首页展示", className: "published", active: true };
}

function renderFeaturedCampaigns() {
  if (!contentState.data) return;
  const { escapeHtml } = window.adminConsole;
  const campaigns = contentState.data.featuredCampaigns || [];
  const statuses = campaigns.map(getFeaturedStatus);
  document.getElementById("featuredAdminTotal").textContent = String(campaigns.length);
  document.getElementById("featuredAdminPublished").textContent = String(campaigns.filter((item) => item.published).length);
  document.getElementById("featuredAdminActive").textContent = String(statuses.filter((status) => status.active).length);
  document.getElementById("overviewFeaturedCount").textContent = String(statuses.filter((status) => status.active).length);
  featuredEmpty.hidden = campaigns.length > 0;
  featuredBody.innerHTML = campaigns.map((item) => {
    const status = getFeaturedStatus(item);
    const platform = item.platform || FEATURED_PLATFORMS[item.platformKey] || item.platformKey;
    const start = item.startsAt ? new Date(item.startsAt).toLocaleString("zh-CN", { hour12: false }) : "立即生效";
    const end = item.endAt ? new Date(item.endAt).toLocaleString("zh-CN", { hour12: false }) : "长期有效";
    return `<tr>
      <td><div class="campaign-name"><img src="/assets/exchanges/${escapeHtml(item.platformKey)}.svg" alt="${escapeHtml(platform)} Logo" /><span><span class="admin-title-line"><strong>${escapeHtml(platform)}</strong><em class="admin-badge ${status.className}">${status.label}</em></span><small>${escapeHtml(item.activity)}</small></span></div></td>
      <td><div class="cell-stack"><strong>${escapeHtml(item.task)}</strong><span>${escapeHtml(item.audience || "适用人群待补")}</span></div></td>
      <td><div class="featured-date"><strong>${escapeHtml(end)}</strong><span>${escapeHtml(start)}</span></div></td>
      <td><span class="admin-badge ${status.className}">${status.label}</span></td>
      <td><div class="row-actions"><button type="button" data-featured-edit="${escapeHtml(item.id)}">编辑</button><button class="delete-button" type="button" data-featured-delete="${escapeHtml(item.id)}">删除</button></div></td>
    </tr>`;
  }).join("");
}

function flatTools() {
  if (!contentState.data) return [];
  return [
    ...contentState.data.essentials.map((item) => ({ ...item, kind: "essential", groupId: "essential", groupTitle: "必备入口" })),
    ...contentState.data.toolGroups.flatMap((group) => group.items.map((item) => ({ ...item, kind: "directory", groupId: group.id, groupTitle: group.title, groupLabel: group.label }))),
  ];
}

function refreshGroupSelects() {
  const groups = contentState.data?.toolGroups || [];
  document.getElementById("toolGroup").innerHTML = groups.map((group) => `<option value="${window.adminConsole.escapeHtml(group.id)}">${window.adminConsole.escapeHtml(group.title)}</option>`).join("");
  const filter = document.getElementById("toolAdminGroup");
  const current = filter.value || "all";
  filter.innerHTML = `<option value="all">全部分类</option><option value="essential">必备入口</option>${groups.map((group) => `<option value="${window.adminConsole.escapeHtml(group.id)}">${window.adminConsole.escapeHtml(group.title)}</option>`).join("")}`;
  filter.value = [...filter.options].some((option) => option.value === current) ? current : "all";
}

function renderTools() {
  if (!contentState.data) return;
  const { escapeHtml } = window.adminConsole;
  const all = flatTools();
  const query = contentState.query.trim().toLowerCase();
  const visible = all.filter((item) => (contentState.group === "all" || item.groupId === contentState.group) && (!query || [item.name, item.description, item.groupTitle, item.code].join(" ").toLowerCase().includes(query)));
  const directoryCount = contentState.data.toolGroups.reduce((sum, group) => sum + group.items.length, 0);
  document.getElementById("essentialAdminCount").textContent = String(contentState.data.essentials.length);
  document.getElementById("toolAdminCount").textContent = String(directoryCount);
  document.getElementById("toolGroupAdminCount").textContent = String(contentState.data.toolGroups.length);
  document.getElementById("overviewToolCount").textContent = String(all.length);
  toolEmpty.hidden = visible.length > 0;
  toolBody.innerHTML = visible.map((item) => `
    <tr>
      <td><div class="cell-stack"><strong>${escapeHtml(item.name)}</strong>${item.code ? `<span>邀请码 ${escapeHtml(item.code)}</span>` : ""}</div></td>
      <td><div class="cell-stack"><strong>${escapeHtml(item.groupTitle)}</strong><span>${escapeHtml(item.kind === "essential" ? item.type : item.groupLabel || "")}</span></div></td>
      <td>${escapeHtml(item.description || "待补")}</td>
      <td>${item.url ? `<a class="admin-link-inline" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开</a>` : `<span class="muted">无外链</span>`}</td>
      <td><div class="row-actions"><button type="button" data-tool-edit="${escapeHtml(item.id)}">编辑</button><button class="delete-button" type="button" data-tool-delete="${escapeHtml(item.id)}">删除</button></div></td>
    </tr>`).join("");
}

function renderTutorials() {
  if (!contentState.data) return;
  const { escapeHtml } = window.adminConsole;
  const tutorials = contentState.data.tutorials || [];
  document.getElementById("overviewTutorialCount").textContent = String(tutorials.length);
  document.getElementById("tutorialAdminGrid").innerHTML = tutorials.map((item) => `
    <article class="tutorial-admin-card">
      <span>${escapeHtml(item.stage)}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "待补充学习内容")}</p><small>${escapeHtml(item.audience || "适合人群待补")}</small>${item.url ? `<a class="admin-link-inline" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看教程</a>` : ""}</div>
      <div class="row-actions"><button type="button" data-tutorial-edit="${escapeHtml(item.id)}">编辑</button><button class="delete-button" type="button" data-tutorial-delete="${escapeHtml(item.id)}">删除</button></div>
    </article>`).join("");
}

function renderContent() {
  renderFeaturedCampaigns();
  refreshGroupSelects();
  renderTools();
  renderTutorials();
}

function updateToolFieldVisibility() {
  const essential = document.getElementById("toolPlacement").value === "essential";
  document.getElementById("toolGroupLabel").hidden = essential;
  document.getElementById("toolTypeLabel").hidden = !essential;
  document.getElementById("toolCodeLabel").hidden = !essential;
}

function openToolDialog(item = null) {
  contentState.toolEditing = item ? { id: item.id, kind: item.kind, groupId: item.groupId } : null;
  document.getElementById("toolDialogTitle").textContent = item ? "编辑工具" : "新增工具";
  toolForm.reset();
  document.getElementById("toolPlacement").value = item?.kind || "directory";
  document.getElementById("toolGroup").value = item?.groupId && item.groupId !== "essential" ? item.groupId : contentState.data.toolGroups[0]?.id || "";
  document.getElementById("toolType").value = item?.type || "";
  document.getElementById("toolName").value = item?.name || "";
  document.getElementById("toolDescription").value = item?.description || "";
  document.getElementById("toolCode").value = item?.code || "";
  document.getElementById("toolUrl").value = item?.url || "";
  updateToolFieldVisibility();
  toolDialog.showModal();
}

function removeToolFromState(editing) {
  if (!editing) return;
  if (editing.kind === "essential") contentState.data.essentials = contentState.data.essentials.filter((item) => item.id !== editing.id);
  else contentState.data.toolGroups = contentState.data.toolGroups.map((group) => group.id === editing.groupId ? { ...group, items: group.items.filter((item) => item.id !== editing.id) } : group);
}

function openTutorialDialog(item = null) {
  contentState.tutorialEditingId = item?.id || null;
  document.getElementById("tutorialDialogTitle").textContent = item ? "编辑教程" : "新增教程";
  tutorialForm.reset();
  document.getElementById("tutorialStage").value = item?.stage || String((contentState.data.tutorials.length + 1)).padStart(2, "0");
  document.getElementById("tutorialTitle").value = item?.title || "";
  document.getElementById("tutorialDescription").value = item?.description || "";
  document.getElementById("tutorialAudience").value = item?.audience || "";
  document.getElementById("tutorialUrl").value = item?.url || "";
  tutorialDialog.showModal();
}

function openFeaturedDialog(item = null) {
  contentState.featuredEditingId = item?.id || null;
  document.getElementById("featuredDialogTitle").textContent = item ? "编辑首页活动" : "新增首页活动";
  featuredForm.reset();
  document.getElementById("featuredPlatformKey").value = item?.platformKey || "binance";
  document.getElementById("featuredActivity").value = item?.activity || "新用户任务";
  document.getElementById("featuredTask").value = item?.task || "";
  document.getElementById("featuredDescription").value = item?.description || "";
  document.getElementById("featuredAudience").value = item?.audience || "新用户";
  document.getElementById("featuredTags").value = (item?.tags || []).join(", ");
  document.getElementById("featuredStartsAt").value = formatDateTimeLocal(item?.startsAt);
  document.getElementById("featuredEndAt").value = formatDateTimeLocal(item?.endAt);
  document.getElementById("featuredLastVerifiedAt").value = formatDateTimeLocal(item?.lastVerifiedAt || new Date().toISOString());
  document.getElementById("featuredSourceUrl").value = item?.sourceUrl || "";
  document.getElementById("featuredPublished").checked = item ? item.published !== false : false;
  featuredDialog.showModal();
}

async function persistContent(message, statusElement) {
  const { apiRequest, setStatus } = window.adminConsole;
  setStatus(statusElement, "正在保存…");
  const result = await apiRequest(CONTENT_API, { method: "PUT", body: JSON.stringify(contentState.data) });
  contentState.data = normalizeContentData(result.data);
  renderContent();
  setStatus(statusElement, message, "success");
}

async function loadContentAdmin() {
  try {
    contentState.data = normalizeContentData(await window.adminConsole.apiRequest(CONTENT_API));
    renderContent();
  } catch (error) {
    window.adminConsole.setStatus(toolSaveStatus, error.message, "error");
  }
}

document.getElementById("addToolButton").addEventListener("click", () => openToolDialog());
document.getElementById("closeToolDialog").addEventListener("click", () => toolDialog.close());
document.getElementById("cancelToolDialog").addEventListener("click", () => toolDialog.close());
document.getElementById("toolPlacement").addEventListener("change", updateToolFieldVisibility);
document.getElementById("toolAdminSearch").addEventListener("input", (event) => { contentState.query = event.target.value; renderTools(); });
document.getElementById("toolAdminGroup").addEventListener("change", (event) => { contentState.group = event.target.value; renderTools(); });

document.getElementById("addFeaturedButton").addEventListener("click", () => openFeaturedDialog());
document.getElementById("closeFeaturedDialog").addEventListener("click", () => featuredDialog.close());
document.getElementById("cancelFeaturedDialog").addEventListener("click", () => featuredDialog.close());

featuredForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previous = structuredClone(contentState.data.featuredCampaigns);
  const existing = contentState.data.featuredCampaigns.find((item) => item.id === contentState.featuredEditingId);
  const platformKey = document.getElementById("featuredPlatformKey").value;
  const startsAt = document.getElementById("featuredStartsAt").value;
  const endAt = document.getElementById("featuredEndAt").value;
  if (startsAt && endAt && Date.parse(endAt) <= Date.parse(startsAt)) {
    window.adminConsole.setStatus(featuredSaveStatus, "到期时间必须晚于开始时间。", "error");
    return;
  }
  const campaign = {
    id: existing?.id || `featured-${Date.now().toString(36)}`,
    platformKey,
    platform: FEATURED_PLATFORMS[platformKey],
    activity: document.getElementById("featuredActivity").value.trim(),
    task: document.getElementById("featuredTask").value.trim(),
    description: document.getElementById("featuredDescription").value.trim(),
    audience: document.getElementById("featuredAudience").value.trim(),
    tags: document.getElementById("featuredTags").value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    endAt: endAt ? new Date(endAt).toISOString() : null,
    lastVerifiedAt: document.getElementById("featuredLastVerifiedAt").value ? new Date(document.getElementById("featuredLastVerifiedAt").value).toISOString() : null,
    sourceUrl: document.getElementById("featuredSourceUrl").value.trim(),
    published: document.getElementById("featuredPublished").checked,
  };
  contentState.data.featuredCampaigns = existing
    ? contentState.data.featuredCampaigns.map((item) => item.id === existing.id ? campaign : item)
    : [...contentState.data.featuredCampaigns, campaign];
  featuredDialog.close();
  renderContent();
  try { await persistContent("首页活动已保存。", featuredSaveStatus); }
  catch (error) { contentState.data.featuredCampaigns = previous; renderContent(); window.adminConsole.setStatus(featuredSaveStatus, error.message, "error"); }
});

featuredBody.addEventListener("click", async (event) => {
  const edit = event.target.closest("button[data-featured-edit]");
  if (edit) {
    openFeaturedDialog(contentState.data.featuredCampaigns.find((item) => item.id === edit.dataset.featuredEdit));
    return;
  }
  const remove = event.target.closest("button[data-featured-delete]");
  if (!remove) return;
  const item = contentState.data.featuredCampaigns.find((entry) => entry.id === remove.dataset.featuredDelete);
  if (!item || !window.confirm(`确定删除“${item.platform} ${item.activity}”吗？`)) return;
  const previous = structuredClone(contentState.data.featuredCampaigns);
  contentState.data.featuredCampaigns = contentState.data.featuredCampaigns.filter((entry) => entry.id !== item.id);
  renderContent();
  try { await persistContent("首页活动已删除。", featuredSaveStatus); }
  catch (error) { contentState.data.featuredCampaigns = previous; renderContent(); window.adminConsole.setStatus(featuredSaveStatus, error.message, "error"); }
});

toolForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previous = structuredClone(contentState.data);
  const id = contentState.toolEditing?.id || `tool-${Date.now().toString(36)}`;
  const placement = document.getElementById("toolPlacement").value;
  removeToolFromState(contentState.toolEditing);
  if (placement === "essential") {
    contentState.data.essentials.push({ id, type: document.getElementById("toolType").value.trim(), name: document.getElementById("toolName").value.trim(), description: document.getElementById("toolDescription").value.trim(), code: document.getElementById("toolCode").value.trim(), url: document.getElementById("toolUrl").value.trim() });
  } else {
    const groupId = document.getElementById("toolGroup").value;
    contentState.data.toolGroups = contentState.data.toolGroups.map((group) => group.id === groupId ? { ...group, items: [...group.items, { id, name: document.getElementById("toolName").value.trim(), description: document.getElementById("toolDescription").value.trim(), url: document.getElementById("toolUrl").value.trim() }] } : group);
  }
  toolDialog.close(); renderContent();
  try { await persistContent("工具已保存。", toolSaveStatus); }
  catch (error) { contentState.data = previous; renderContent(); window.adminConsole.setStatus(toolSaveStatus, error.message, "error"); }
});

toolBody.addEventListener("click", async (event) => {
  const edit = event.target.closest("button[data-tool-edit]");
  if (edit) { openToolDialog(flatTools().find((item) => item.id === edit.dataset.toolEdit)); return; }
  const remove = event.target.closest("button[data-tool-delete]");
  if (!remove) return;
  const item = flatTools().find((entry) => entry.id === remove.dataset.toolDelete);
  if (!item || !window.confirm(`确定删除“${item.name}”吗？`)) return;
  const previous = structuredClone(contentState.data); removeToolFromState(item); renderContent();
  try { await persistContent("工具已删除。", toolSaveStatus); }
  catch (error) { contentState.data = previous; renderContent(); window.adminConsole.setStatus(toolSaveStatus, error.message, "error"); }
});

document.getElementById("addTutorialButton").addEventListener("click", () => openTutorialDialog());
document.getElementById("closeTutorialDialog").addEventListener("click", () => tutorialDialog.close());
document.getElementById("cancelTutorialDialog").addEventListener("click", () => tutorialDialog.close());

tutorialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previous = structuredClone(contentState.data.tutorials);
  const existing = contentState.data.tutorials.find((item) => item.id === contentState.tutorialEditingId);
  const tutorial = { id: existing?.id || `tutorial-${Date.now().toString(36)}`, stage: document.getElementById("tutorialStage").value.trim(), title: document.getElementById("tutorialTitle").value.trim(), description: document.getElementById("tutorialDescription").value.trim(), audience: document.getElementById("tutorialAudience").value.trim(), url: document.getElementById("tutorialUrl").value.trim() };
  contentState.data.tutorials = existing ? contentState.data.tutorials.map((item) => item.id === existing.id ? tutorial : item) : [...contentState.data.tutorials, tutorial];
  tutorialDialog.close(); renderContent();
  try { await persistContent("教程已保存。", document.getElementById("tutorialSaveStatus")); }
  catch (error) { contentState.data.tutorials = previous; renderContent(); window.adminConsole.setStatus(document.getElementById("tutorialSaveStatus"), error.message, "error"); }
});

document.getElementById("tutorialAdminGrid").addEventListener("click", async (event) => {
  const edit = event.target.closest("button[data-tutorial-edit]");
  if (edit) { openTutorialDialog(contentState.data.tutorials.find((item) => item.id === edit.dataset.tutorialEdit)); return; }
  const remove = event.target.closest("button[data-tutorial-delete]");
  if (!remove) return;
  const item = contentState.data.tutorials.find((entry) => entry.id === remove.dataset.tutorialDelete);
  if (!item || !window.confirm(`确定删除“${item.title}”吗？`)) return;
  const previous = structuredClone(contentState.data.tutorials);
  contentState.data.tutorials = contentState.data.tutorials.filter((entry) => entry.id !== item.id); renderContent();
  try { await persistContent("教程已删除。", document.getElementById("tutorialSaveStatus")); }
  catch (error) { contentState.data.tutorials = previous; renderContent(); window.adminConsole.setStatus(document.getElementById("tutorialSaveStatus"), error.message, "error"); }
});

window.addEventListener("admin:connected", loadContentAdmin);
