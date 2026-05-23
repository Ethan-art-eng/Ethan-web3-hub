const campaignBody = document.getElementById("campaignTableBody");
const campaignDisclaimer = document.getElementById("campaignDisclaimer");
const campaignSource = document.getElementById("campaignSource");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchCampaigns() {
  const endpoints = ["/api/cex-yields", "../data/cex-yields.json"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      // Try the next endpoint so GitHub Pages/local preview still works.
    }
  }

  throw new Error("无法加载交易所理财数据");
}

function renderCampaigns(data) {
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

  if (!campaigns.length) {
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="7">暂无交易所理财活动记录</td></tr>`;
    return;
  }

  campaignBody.innerHTML = campaigns
    .map(
      (item) => `
        <tr>
          <td data-label="交易所"><strong>${escapeHtml(item.exchange)}</strong></td>
          <td data-label="稳定币">${escapeHtml(item.asset)}</td>
          <td data-label="产品类型">${escapeHtml(item.product)}</td>
          <td data-label="赎回">${escapeHtml(item.redemption)}</td>
          <td data-label="当前记录"><span class="status-pill neutral">${escapeHtml(item.status)}</span></td>
          <td data-label="风险检查">${escapeHtml(item.risk)}</td>
          <td data-label="入口"><a class="table-link" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">打开</a></td>
        </tr>
      `
    )
    .join("");

  const updatedAt = data.updatedAt ? `更新日期：${escapeHtml(data.updatedAt)}。` : "";
  campaignDisclaimer.textContent = `${updatedAt}${data.notice || "数据仅供研究，不构成投资建议。"}`;
  if (campaignSource) {
    campaignSource.textContent = data.source === "kv" ? "数据源：Cloudflare KV" : "数据源：默认数据";
  }
}

fetchCampaigns()
  .then(renderCampaigns)
  .catch((error) => {
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    campaignDisclaimer.textContent = "数据加载失败，请稍后重试。";
  });
