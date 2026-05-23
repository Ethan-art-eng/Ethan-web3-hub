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
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="4">暂无交易所理财活动记录</td></tr>`;
    return;
  }

  campaignBody.innerHTML = campaigns
    .map(
      (item) => `
        <tr>
          <td data-label="活动"><strong>${escapeHtml(item.activity)}</strong></td>
          <td data-label="年利率"><span class="rate-pill">${escapeHtml(item.apy)}</span></td>
          <td data-label="到期时间">${escapeHtml(item.endTime)}</td>
          <td data-label="备注">${escapeHtml(item.note)}</td>
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
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
    campaignDisclaimer.textContent = "数据加载失败，请稍后重试。";
  });
