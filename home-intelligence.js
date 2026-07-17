const filterButtons = document.querySelectorAll("[data-event-filter]");
const timelineList = document.querySelector("[data-timeline-list]");
let currentFilter = "all";
let timelineEvents = [];

const categoryMeta = {
  airdrop: { label: "空投", href: "/airdrops/" },
  wealth: { label: "理财", href: "/wealth/" },
  toolbox: { label: "工具", href: "/toolbox/" },
  courses: { label: "教程", href: "/courses/" },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value)
    .replace(" (UTC+8)", "+08:00")
    .replace(/ (UTC)$/, "Z")
    .replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatEventTime(value) {
  const date = parseDate(value);
  if (!date) return "待核验";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysUntil(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

async function fetchJson(primaryUrl, fallbackUrl) {
  for (const [index, url] of [primaryUrl, fallbackUrl].entries()) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { data: await response.json(), fallback: index === 1 };
    } catch (error) {
      if (index === 1) throw error;
    }
  }
  throw new Error("Content data unavailable");
}

const aiOutput = document.querySelector("[data-ai-output]");
let aiMessages = [
  "正在同步站内机会、工具与教程数据…",
  "正在核验公开活动与项目状态…",
  "正在建立实时事件流…",
];

if (aiOutput) {
  let messageIndex = 0;
  let characterIndex = 0;

  const typeMessage = () => {
    const message = aiMessages[messageIndex];
    aiOutput.textContent = message.slice(0, characterIndex);
    characterIndex += 1;
    if (characterIndex <= message.length) {
      window.setTimeout(typeMessage, 48);
      return;
    }
    window.setTimeout(() => {
      messageIndex = (messageIndex + 1) % aiMessages.length;
      characterIndex = 0;
      typeMessage();
    }, 1700);
  };

  typeMessage();
}

function updateMetric(key, value, detail) {
  setText(`[data-node-value="${key}"]`, String(value));
  setText(`[data-node-detail="${key}"]`, detail);
}

function renderTimeline() {
  if (!timelineList) return;
  const filtered = timelineEvents.filter((event) => currentFilter === "all" || event.kind === currentFilter);
  if (!filtered.length) {
    timelineList.innerHTML = '<div class="timeline-empty">当前分类暂无更新</div>';
    return;
  }

  const groups = [
    { key: "now", label: "最新更新" },
    { key: "upcoming", label: "未来计划" },
  ];

  timelineList.innerHTML = groups.map((group) => {
    const events = filtered.filter((event) => event.period === group.key);
    if (!events.length) return "";
    return `
      <section class="timeline-group">
        <div class="timeline-group-title">${group.label}</div>
        ${events.map((event) => {
          const meta = categoryMeta[event.kind];
          return `
            <article class="timeline-row" data-kind="${escapeHtml(event.kind)}">
              <time>${escapeHtml(event.time)}</time>
              <span class="timeline-kind">${escapeHtml(meta.label)}</span>
              <span class="timeline-copy"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.description)}</small></span>
              <span class="source-badge">官方来源</span>
              <a href="${escapeHtml(event.href || meta.href)}">查看 →</a>
            </article>`;
        }).join("")}
      </section>`;
  }).join("");
}

function renderSummary(items) {
  const list = document.querySelector("[data-ai-summary]");
  if (!list) return;
  list.innerHTML = items.map((item, index) => `
    <li><b>${index + 1}</b><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span></li>
  `).join("");
}

function renderDeadlines(campaigns) {
  const list = document.querySelector("[data-deadline-list]");
  if (!list) return;
  const dated = campaigns
    .map((campaign) => ({ campaign, date: parseDate(campaign.endAt) }))
    .filter((item) => item.date && item.date.getTime() > Date.now())
    .sort((a, b) => a.date - b.date)
    .slice(0, 3);

  if (!dated.length) {
    list.innerHTML = '<div class="deadline-empty">当前没有带明确日期的到期活动</div>';
    return;
  }

  list.innerHTML = dated.map(({ campaign, date }) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `
      <a class="deadline-item" href="/wealth/">
        <span class="deadline-date">${month}月<b>${day}</b></span>
        <span><strong>${escapeHtml(campaign.activity)}</strong><small>${escapeHtml(campaign.exchange)} · ${escapeHtml(campaign.apy)}</small></span>
        <span class="deadline-countdown">剩余 ${daysUntil(date)} 天</span>
      </a>`;
  }).join("");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.eventFilter || "all";
    filterButtons.forEach((control) => {
      const selected = control === button;
      control.classList.toggle("active", selected);
      control.setAttribute("aria-pressed", String(selected));
    });
    renderTimeline();
  });
});

Promise.all([
  fetchJson("/api/airdrop-projects", "/data/airdrop-projects.json"),
  fetchJson("/api/cex-yields", "/data/cex-yields.json"),
  fetchJson("/api/site-content", "/data/site-content.json"),
]).then(([airdropResult, yieldResult, contentResult]) => {
  const airdropData = airdropResult.data || {};
  const yieldData = yieldResult.data || {};
  const contentData = contentResult.data || {};
  const activeAirdrops = (airdropData.projects || []).filter((item) => item.year === "2026" && item.status === "进行中");
  const activeCampaigns = (yieldData.campaigns || []).filter((item) => item.published !== false && (!item.endAt || Date.parse(item.endAt) > Date.now()));
  const tools = (contentData.toolGroups || []).flatMap((group) => group.items || []);
  const tutorials = contentData.tutorials || [];
  const topCampaign = [...activeCampaigns].sort((a, b) => Number(b.apyValue || 0) - Number(a.apyValue || 0))[0];
  const featuredAirdrop = activeAirdrops[0];
  const featuredTool = tools.find((item) => item.name === "RootData") || tools[0];
  const featuredTutorial = tutorials[0];

  updateMetric("airdrop", activeAirdrops.length, "2026 进行中");
  updateMetric("wealth", activeCampaigns.length, "公开活动");
  updateMetric("toolbox", tools.length, `${(contentData.toolGroups || []).length} 个场景`);
  updateMetric("courses", tutorials.length, "实战教程");

  const briefingParts = [
    `当前收录 ${activeAirdrops.length} 个进行中的 2026 重点空投`,
    `${activeCampaigns.length} 个公开理财活动`,
    `${tools.length} 个实用工具和 ${tutorials.length} 篇教程`,
  ];
  setText("[data-ai-briefing]", `${briefingParts.join("，")}。内容按官方来源和后台更新时间持续整理。`);

  const sourceDates = [airdropData.updatedAt, yieldData.updatedAt, contentData.updatedAt]
    .map(parseDate)
    .filter(Boolean)
    .sort((a, b) => b - a);
  setText("[data-last-sync]", sourceDates[0] ? formatDateTime(sourceDates[0]) : "待同步");

  timelineEvents = [
    featuredAirdrop && {
      kind: "airdrop",
      period: "now",
      time: formatEventTime(airdropData.updatedAt),
      title: `${featuredAirdrop.name} 项目状态已同步`,
      description: `${featuredAirdrop.category} · ${featuredAirdrop.funding || "融资待核验"}`,
      href: `/airdrops/?year=2026&q=${encodeURIComponent(featuredAirdrop.name)}`,
    },
    topCampaign && {
      kind: "wealth",
      period: "now",
      time: formatEventTime(yieldData.updatedAt),
      title: `${topCampaign.exchange} ${topCampaign.activity}`,
      description: `${topCampaign.apy} · ${topCampaign.eligibility || "资格以官方页面为准"}`,
      href: "/wealth/",
    },
    featuredTool && {
      kind: "toolbox",
      period: "now",
      time: formatEventTime(contentData.updatedAt),
      title: `${featuredTool.name} 已收入工具目录`,
      description: featuredTool.description || "实用工具入口",
      href: `/toolbox/?q=${encodeURIComponent(featuredTool.name)}`,
    },
    featuredTutorial && {
      kind: "courses",
      period: "now",
      time: formatEventTime(contentData.updatedAt),
      title: `${featuredTutorial.title} 教程可阅读`,
      description: featuredTutorial.description,
      href: featuredTutorial.url || "/courses/",
    },
    ...activeCampaigns.filter((campaign) => campaign.endAt).map((campaign) => ({
      kind: "wealth",
      period: "upcoming",
      time: formatEventTime(campaign.endAt),
      title: `${campaign.exchange} 活动到期`,
      description: `${campaign.activity} · 剩余 ${daysUntil(campaign.endAt)} 天`,
      href: "/wealth/",
    })),
  ].filter(Boolean);

  renderTimeline();
  renderDeadlines(activeCampaigns);
  renderSummary([
    {
      title: `${activeAirdrops.length} 个重点空投仍在进行`,
      description: featuredAirdrop ? `最近同步项目为 ${featuredAirdrop.name}，参与前应再次核验官方任务页面。` : "等待下一次项目更新。",
    },
    {
      title: `${activeCampaigns.length} 个理财活动公开展示`,
      description: topCampaign ? `${topCampaign.exchange} 当前展示最高年利率 ${topCampaign.apy}，资格和额度以账户页面为准。` : "当前没有符合展示条件的活动。",
    },
  ]);

  const usingFallback = airdropResult.fallback || yieldResult.fallback || contentResult.fallback;
  setText("[data-data-source]", usingFallback ? "本地数据" : "实时数据");
  aiMessages = [
    `已同步 ${activeAirdrops.length} 个重点空投与 ${activeCampaigns.length} 个公开活动…`,
    `正在整理 ${tools.length} 个工具与 ${tutorials.length} 篇教程…`,
    "实时事件流已连接站内最新数据…",
  ];
}).catch((error) => {
  console.warn("首页动态数据暂时不可用。", error);
  setText("[data-data-source]", "等待同步");
  setText("[data-ai-briefing]", "数据暂时无法连接，请稍后刷新页面。");
  if (timelineList) timelineList.innerHTML = '<div class="timeline-empty">数据暂时无法连接</div>';
});
