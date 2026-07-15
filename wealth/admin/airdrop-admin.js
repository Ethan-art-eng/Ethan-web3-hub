const AIRDROP_API = "/wealth/admin/api/airdrop-projects";
const airdropState = { data: null, editingId: null, query: "", year: "2026", status: "全部" };

const airdropBody = document.getElementById("airdropAdminBody");
const airdropEmpty = document.getElementById("airdropAdminEmpty");
const airdropSaveStatus = document.getElementById("airdropSaveStatus");
const airdropDialog = document.getElementById("airdropDialog");
const airdropForm = document.getElementById("airdropForm");

function airdropFiltered() {
  const query = airdropState.query.trim().toLowerCase();
  return (airdropState.data?.projects || []).filter((project) => {
    const matchesYear = project.year === airdropState.year;
    const matchesStatus = airdropState.status === "全部" || project.status === airdropState.status;
    const text = [project.name, project.category, project.funding, project.investors, project.cost, project.accounts, project.profit, project.note].join(" ").toLowerCase();
    return matchesYear && matchesStatus && (!query || text.includes(query));
  });
}

function renderAirdropAdmin() {
  if (!airdropState.data) return;
  const { escapeHtml } = window.adminConsole;
  const projects = airdropState.data.projects || [];
  const visible = airdropFiltered();
  document.getElementById("airdropAdminTotal").textContent = String(projects.length);
  document.getElementById("airdropAdminActive").textContent = String(projects.filter((item) => item.status === "进行中").length);
  document.getElementById("airdropAdminDone").textContent = String(projects.filter((item) => item.status === "已空投").length);
  document.getElementById("overviewAirdropCount").textContent = String(projects.length);
  airdropEmpty.hidden = visible.length > 0;
  airdropBody.innerHTML = visible.map((project) => `
    <tr>
      <td><div class="cell-stack"><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(project.year)} · ${escapeHtml(project.category || "待补")}</span><small>${escapeHtml(project.note || "")}</small></div></td>
      <td><div class="cell-stack"><strong>${escapeHtml(project.funding || "待补")}</strong><span>${escapeHtml(project.investors || "待补")}</span></div></td>
      <td><div class="cell-stack"><strong>${escapeHtml(project.cost || "待补")}</strong><span>建议上号 ${escapeHtml(project.accounts || "待补")}</span></div></td>
      <td><div class="cell-stack"><strong><em class="admin-badge ${project.status === "已空投" ? "draft" : "published"}">${escapeHtml(project.status)}</em></strong><span>${escapeHtml(project.profit || "待观察")}</span></div></td>
      <td><div class="row-actions">${project.link ? `<a class="button-link" href="${escapeHtml(project.link)}" target="_blank" rel="noreferrer">打开</a>` : ""}<button type="button" data-airdrop-edit="${escapeHtml(project.id)}">编辑</button><button class="delete-button" type="button" data-airdrop-delete="${escapeHtml(project.id)}">删除</button></div></td>
    </tr>`).join("");
}

function openAirdropDialog(project = null) {
  airdropState.editingId = project?.id || null;
  document.getElementById("airdropDialogTitle").textContent = project ? "编辑项目" : "新增项目";
  airdropForm.reset();
  document.getElementById("airdropYear").value = project?.year || airdropState.year;
  document.getElementById("airdropStatus").value = project?.status || "进行中";
  document.getElementById("airdropName").value = project?.name || "";
  document.getElementById("airdropCategory").value = project?.category || "";
  document.getElementById("airdropFunding").value = project?.funding || "";
  document.getElementById("airdropInvestors").value = project?.investors || "";
  document.getElementById("airdropCost").value = project?.cost || "";
  document.getElementById("airdropAccounts").value = project?.accounts || "";
  document.getElementById("airdropProfit").value = project?.profit || "";
  document.getElementById("airdropLink").value = project?.link || "";
  document.getElementById("airdropNote").value = project?.note || "";
  airdropDialog.showModal();
}

async function persistAirdrops(message) {
  const { apiRequest, setStatus } = window.adminConsole;
  setStatus(airdropSaveStatus, "正在保存…");
  const result = await apiRequest(AIRDROP_API, { method: "PUT", body: JSON.stringify(airdropState.data) });
  airdropState.data = result.data;
  renderAirdropAdmin();
  setStatus(airdropSaveStatus, message, "success");
}

async function loadAirdrops() {
  const { apiRequest, setStatus } = window.adminConsole;
  try {
    airdropState.data = await apiRequest(AIRDROP_API);
    renderAirdropAdmin();
    setStatus(airdropSaveStatus, "");
  } catch (error) {
    setStatus(airdropSaveStatus, error.message, "error");
  }
}

document.getElementById("addAirdropButton").addEventListener("click", () => openAirdropDialog());
document.getElementById("closeAirdropDialog").addEventListener("click", () => airdropDialog.close());
document.getElementById("cancelAirdropDialog").addEventListener("click", () => airdropDialog.close());
document.getElementById("airdropAdminSearch").addEventListener("input", (event) => { airdropState.query = event.target.value; renderAirdropAdmin(); });
document.getElementById("airdropAdminYear").addEventListener("change", (event) => { airdropState.year = event.target.value; renderAirdropAdmin(); });
document.getElementById("airdropAdminStatus").addEventListener("change", (event) => { airdropState.status = event.target.value; renderAirdropAdmin(); });

airdropForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previous = structuredClone(airdropState.data.projects);
  const existing = airdropState.data.projects.find((item) => item.id === airdropState.editingId);
  const project = {
    id: existing?.id || `airdrop-${Date.now().toString(36)}`,
    year: document.getElementById("airdropYear").value,
    status: document.getElementById("airdropStatus").value,
    name: document.getElementById("airdropName").value.trim(),
    category: document.getElementById("airdropCategory").value.trim(),
    funding: document.getElementById("airdropFunding").value.trim(),
    investors: document.getElementById("airdropInvestors").value.trim(),
    cost: document.getElementById("airdropCost").value.trim(),
    accounts: document.getElementById("airdropAccounts").value.trim(),
    profit: document.getElementById("airdropProfit").value.trim(),
    link: document.getElementById("airdropLink").value.trim(),
    note: document.getElementById("airdropNote").value.trim(),
  };
  airdropState.data.projects = existing ? airdropState.data.projects.map((item) => item.id === existing.id ? project : item) : [project, ...airdropState.data.projects];
  airdropState.year = project.year;
  document.getElementById("airdropAdminYear").value = project.year;
  airdropDialog.close();
  renderAirdropAdmin();
  try { await persistAirdrops(existing ? "项目已更新。" : "项目已新增。"); }
  catch (error) { airdropState.data.projects = previous; renderAirdropAdmin(); window.adminConsole.setStatus(airdropSaveStatus, error.message, "error"); }
});

airdropBody.addEventListener("click", async (event) => {
  const edit = event.target.closest("button[data-airdrop-edit]");
  if (edit) { openAirdropDialog(airdropState.data.projects.find((item) => item.id === edit.dataset.airdropEdit)); return; }
  const remove = event.target.closest("button[data-airdrop-delete]");
  if (!remove) return;
  const project = airdropState.data.projects.find((item) => item.id === remove.dataset.airdropDelete);
  if (!project || !window.confirm(`确定删除“${project.name}”吗？`)) return;
  const previous = structuredClone(airdropState.data.projects);
  airdropState.data.projects = airdropState.data.projects.filter((item) => item.id !== project.id);
  renderAirdropAdmin();
  try { await persistAirdrops("项目已删除。"); }
  catch (error) { airdropState.data.projects = previous; renderAirdropAdmin(); window.adminConsole.setStatus(airdropSaveStatus, error.message, "error"); }
});

window.addEventListener("admin:connected", loadAirdrops);
