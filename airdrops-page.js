const pageSize = 10;
let activeView = "2026";
let currentPage = 1;

const body = document.getElementById("airdropTableBody");
const tabs = document.getElementById("airdropViewTabs");
const pagination = document.getElementById("airdropPagination");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cell(value, className = "") {
  const text = value || "待补";
  const muted = !value || ["待补", "待补充", "未公布", "待观察"].includes(text);
  return `<td class="${className || (muted ? "muted" : "")}">${escapeHtml(text)}</td>`;
}

function renderSummary(items) {
  const total = items.length;
  const done = items.filter((item) => item.status === "已空投").length;
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
  const items = window.airdropData[activeView] || [];
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  body.innerHTML = pageItems
    .map((item) => {
      const doneClass = item.status === "已空投" ? " done" : "";
      const link = item.link
        ? `<a class="table-link" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">打开</a>`
        : `<span class="muted">待补</span>`;
      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          ${cell(item.category)}
          ${cell(item.funding, item.funding && item.funding !== "未公布" && item.funding !== "待补充" ? "money" : "")}
          ${cell(item.investors)}
          ${cell(item.cost)}
          ${cell(item.accounts)}
          <td><span class="status-pill${doneClass}">${escapeHtml(item.status || "进行中")}</span></td>
          ${cell(item.update)}
          ${cell(item.profit, item.profit && item.profit !== "待观察" ? "profit" : "")}
          <td>${link}</td>
          ${cell(item.note)}
        </tr>
      `;
    })
    .join("");

  renderSummary(items);
  renderTabs();
  renderPagination(pages);
}

function renderPagination(pages) {
  if (pages <= 1) {
    pagination.innerHTML = `<span>共 ${window.airdropData[activeView].length} 个项目</span>`;
    return;
  }

  const buttons = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === currentPage ? "selected" : ""}" type="button" data-page="${page}">${page}</button>`;
  }).join("");

  pagination.innerHTML = `
    <span>每页 ${pageSize} 个，共 ${window.airdropData[activeView].length} 个项目</span>
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

pagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderTable();
});

renderTable();
