const canvas = document.getElementById("signalCanvas");
const board = document.querySelector(".signal-board");
const controls = document.querySelectorAll("[data-signal-view]");

const radarNodes = [
  { key: "airdrop", series: "opportunity", x: .19, y: .25, color: "#0b5cff" },
  { key: "wealth", series: "opportunity", x: .81, y: .28, color: "#08a981" },
  { key: "toolbox", series: "resource", x: .28, y: .75, color: "#f59e0b" },
  { key: "courses", series: "resource", x: .77, y: .74, color: "#6d5ce7" },
];

let radarView = "all";

if (canvas && board) {
  const context = canvas.getContext("2d");
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let phase = 0;

  const resize = () => {
    const rectangle = canvas.getBoundingClientRect();
    width = rectangle.width;
    height = rectangle.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const isVisible = (node) => radarView === "all" || radarView === node.series;

  const curvePoint = (start, control, end, progress) => {
    const inverse = 1 - progress;
    return {
      x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
      y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
    };
  };

  const drawConnection = (node, index) => {
    const start = { x: width * .5, y: height * .5 };
    const end = { x: width * node.x, y: height * node.y };
    const control = {
      x: (start.x + end.x) / 2 + (index % 2 ? 22 : -22),
      y: (start.y + end.y) / 2 + (index < 2 ? -18 : 18),
    };
    const visible = isVisible(node);

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(control.x, control.y, end.x, end.y);
    context.strokeStyle = visible ? `${node.color}66` : `${node.color}16`;
    context.lineWidth = visible ? 1.7 : 1;
    context.stroke();

    context.beginPath();
    context.arc(end.x, end.y, visible ? 4 : 2.5, 0, Math.PI * 2);
    context.fillStyle = visible ? node.color : `${node.color}44`;
    context.fill();

    if (!visible) return;
    const progress = reducedMotion ? .72 : (phase * (.12 + index * .012) + index * .21) % 1;
    const packet = curvePoint(start, control, end, progress);
    context.beginPath();
    context.arc(packet.x, packet.y, 3, 0, Math.PI * 2);
    context.fillStyle = node.color;
    context.shadowColor = node.color;
    context.shadowBlur = 12;
    context.fill();
    context.shadowBlur = 0;
  };

  const draw = () => {
    if (!reducedMotion) phase += .018;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(100,116,139,.13)";
    context.lineWidth = 1;

    for (let x = 0; x < width; x += 54) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y < height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    radarNodes.forEach(drawConnection);

    const hubX = width * .5;
    const hubY = height * .5;
    const pulse = reducedMotion ? 22 : 19 + Math.sin(phase * 2.4) * 4;
    context.beginPath();
    context.arc(hubX, hubY, pulse, 0, Math.PI * 2);
    context.strokeStyle = "rgba(11,92,255,.18)";
    context.stroke();

    if (!reducedMotion) window.requestAnimationFrame(draw);
  };

  controls.forEach((button) => {
    button.addEventListener("click", () => {
      radarView = button.dataset.signalView;
      board.dataset.view = radarView;
      controls.forEach((control) => {
        const selected = control === button;
        control.classList.toggle("active", selected);
        control.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  window.addEventListener("resize", resize);
  resize();
  draw();
}

const aiOutput = document.querySelector("[data-ai-output]");
let aiMessages = [
  "正在同步站内机会、工具与教程数据…",
  "正在核验公开活动与项目状态…",
  "站内机会雷达正在建立内容关系…",
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

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function formatUpdatedAt(value) {
  if (!value) return "--/--";
  const normalized = String(value).replace(" (UTC+8)", "+08:00").replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value).slice(5, 10).replace("-", "/");
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
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

function updateNode(key, value, detail, updatedAt) {
  setText(`[data-node-value="${key}"]`, String(value));
  setText(`[data-node-detail="${key}"]`, detail);
  setText(`[data-node-updated="${key}"]`, formatUpdatedAt(updatedAt));
}

function updateFeed(key, title, meta = "") {
  setText(`[data-feed-title="${key}"]`, title);
  if (meta) setText(`[data-feed-meta="${key}"]`, meta);
}

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
  const topCampaign = [...activeCampaigns].sort((a, b) => Number(b.apyValue || 0) - Number(a.apyValue || 0))[0];
  const tools = (contentData.toolGroups || []).flatMap((group) => group.items || []);
  const tutorials = contentData.tutorials || [];
  const featuredTool = tools.find((item) => item.name === "RootData") || tools[0];
  const featuredTutorial = tutorials[0];
  const featuredAirdrop = activeAirdrops[0];

  updateNode("airdrop", activeAirdrops.length, featuredAirdrop ? `${featuredAirdrop.name} · ${featuredAirdrop.category}` : "暂无进行中项目", airdropData.updatedAt);
  updateNode("wealth", activeCampaigns.length, topCampaign ? `最高 ${topCampaign.apy} · ${topCampaign.exchange}` : "暂无公开活动", yieldData.updatedAt);
  updateNode("toolbox", tools.length, `${(contentData.toolGroups || []).length} 个使用场景 · 支持检索`, contentData.updatedAt);
  updateNode("courses", tutorials.length, featuredTutorial ? `${featuredTutorial.title} 等系列教程` : "教程持续更新", contentData.updatedAt);

  updateFeed("airdrop", featuredAirdrop ? featuredAirdrop.name : "暂无进行中空投", featuredAirdrop ? `${featuredAirdrop.category} · ${featuredAirdrop.funding}` : "等待下一次更新");
  updateFeed("wealth", topCampaign ? topCampaign.activity : "暂无公开理财活动", topCampaign ? `${topCampaign.exchange} · ${topCampaign.apy} · ${topCampaign.endTime}` : "等待下一次更新");
  updateFeed("toolbox", featuredTool ? featuredTool.name : "工具目录");
  updateFeed("courses", featuredTutorial ? featuredTutorial.title : "教程目录");

  const usingFallback = airdropResult.fallback || yieldResult.fallback || contentResult.fallback;
  setText("[data-data-source]", usingFallback ? "本地数据" : "已同步");
  aiMessages = [
    `已同步 ${activeAirdrops.length} 个重点空投与 ${activeCampaigns.length} 个公开活动…`,
    `正在整理 ${tools.length} 个工具与 ${tutorials.length} 篇教程…`,
    "站内机会雷达已连接最新后台数据…",
  ];
}).catch((error) => {
  console.warn("首页动态数据暂时不可用。", error);
  setText("[data-data-source]", "等待同步");
});

const lastSync = document.querySelector("[data-last-sync]");

if (lastSync) {
  const updateClock = () => {
    lastSync.textContent = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  };
  updateClock();
  window.setInterval(updateClock, 1000);
}
