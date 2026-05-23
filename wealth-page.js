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

function getActivityMeta(activity) {
  const text = String(activity || "");
  if (text.includes("Binance") || text.includes("币安")) {
    return { code: "BN", className: "binance", venue: "Binance 主站 -> 活期" };
  }
  if (text.includes("OKX") || text.includes("欧易")) {
    return { code: "OK", className: "okx", venue: "OKX 主站 -> Simple Earn" };
  }
  if (text.includes("Bybit")) {
    return { code: "BY", className: "bybit", venue: "Bybit 主站 -> Earn" };
  }
  if (text.includes("Bitget")) {
    return { code: "BG", className: "bitget", venue: "Bitget 主站 -> Earn" };
  }
  if (text.includes("Gate")) {
    return { code: "GT", className: "gate", venue: "Gate 主站 -> Simple Earn" };
  }
  return { code: "CE", className: "generic", venue: "CEX Earn" };
}

function renderNoteChips(note) {
  return String(note || "")
    .replaceAll("。", "")
    .split(/[、，,；;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => `<span class="note-chip tone-${(index % 4) + 1}">${escapeHtml(item)}</span>`)
    .join("");
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
      (item) => {
        const meta = getActivityMeta(item.activity);
        return `
        <tr class="campaign-row">
          <td data-label="活动">
            <div class="activity-cell">
              <span class="exchange-mark ${meta.className}">${escapeHtml(meta.code)}</span>
              <span>
                <strong>${escapeHtml(item.activity)}</strong>
                <small>${escapeHtml(meta.venue)}</small>
              </span>
            </div>
          </td>
          <td data-label="年利率">
            <strong class="apy-value">${escapeHtml(item.apy)}</strong>
            <small class="apy-note">$10,000 本金预估收益需按官方页核算</small>
          </td>
          <td data-label="到期时间">
            <div class="deadline-cell">
              <strong>${escapeHtml(item.endTime)}</strong>
              <span class="deadline-track"><i></i></span>
            </div>
          </td>
          <td data-label="备注">
            <div class="note-chip-row">${renderNoteChips(item.note)}</div>
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
    campaignBody.innerHTML = `<tr class="empty-row"><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
    campaignDisclaimer.textContent = "数据加载失败，请稍后重试。";
  });
