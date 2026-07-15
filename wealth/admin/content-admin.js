const CONTENT_API = "/wealth/admin/api/site-content";
const contentState = { data: null, toolEditing: null, tutorialEditingId: null, query: "", group: "all" };

const toolBody = document.getElementById("toolAdminBody");
const toolEmpty = document.getElementById("toolAdminEmpty");
const toolSaveStatus = document.getElementById("toolSaveStatus");
const toolDialog = document.getElementById("toolDialog");
const toolForm = document.getElementById("toolForm");
const tutorialDialog = document.getElementById("tutorialDialog");
const tutorialForm = document.getElementById("tutorialForm");

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

async function persistContent(message, statusElement) {
  const { apiRequest, setStatus } = window.adminConsole;
  setStatus(statusElement, "正在保存…");
  const result = await apiRequest(CONTENT_API, { method: "PUT", body: JSON.stringify(contentState.data) });
  contentState.data = result.data;
  renderContent();
  setStatus(statusElement, message, "success");
}

async function loadContentAdmin() {
  try {
    contentState.data = await window.adminConsole.apiRequest(CONTENT_API);
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
