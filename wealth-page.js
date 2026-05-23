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

function getActivityMeta(activity, venue) {
  const text = `${activity || ""} ${venue || ""}`;
  if (text.includes("Binance") || text.includes("币安")) {
    return { code: "BN", className: "binance" };
  }
  if (text.includes("OKX") || text.includes("欧易")) {
    return { code: "OK", className: "okx" };
  }
  if (text.includes("Bybit")) {
    return { code: "BY", className: "bybit" };
  }
  if (text.includes("Bitget")) {
    return { code: "BG", className: "bitget" };
  }
  if (text.includes("Gate")) {
    return { code: "GT", className: "gate" };
  }
  return { code: "CE", className: "generic" };
}

function parseLocalDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function getDeadlineProgress(endTime) {
  const end = parseLocalDate(endTime);
  if (!end) return 42;
  const now = new Date();
  const windowMs = 45 * 24 * 60 * 60 * 1000;
  const remaining = end.getTime() - now.getTime();
  return Math.max(8, Math.min(100, Math.round((remaining / windowMs) * 100)));
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
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="3">暂无交易所理财活动记录</td></tr>`;
    return;
  }

  campaignBody.innerHTML = campaigns
    .map(
      (item) => {
        const meta = getActivityMeta(item.activity, item.venue);
        const deadlineProgress = getDeadlineProgress(item.endTime);
        return `
        <tr class="campaign-row">
          <td data-label="活动">
            <div class="activity-cell">
              <span class="exchange-mark ${meta.className}">${escapeHtml(meta.code)}</span>
              <span>
                <strong>${escapeHtml(item.activity)}</strong>
                <small>${escapeHtml(item.venue)}</small>
              </span>
            </div>
          </td>
          <td data-label="年利率">
            <strong class="apy-value">${escapeHtml(item.apy)}</strong>
          </td>
          <td data-label="到期时间（当地）">
            <div class="deadline-cell">
              <strong>${escapeHtml(item.endTime)}</strong>
              <span class="deadline-track"><i style="width: ${deadlineProgress}%"></i></span>
            </div>
          </td>
        </tr>
      `;
      }
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
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="3">${escapeHtml(error.message)}</td></tr>`;
    campaignDisclaimer.textContent = "数据加载失败，请稍后重试。";
  });
