const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const aiOutput = document.querySelector("[data-ai-output]");
const aiMessages = [
  "正在连接链上、AI 与跨市场信号…",
  "持续扫描公开来源与前沿主题…",
  "跨市场信息网络保持运行…",
];

if (aiOutput) {
  if (reduceMotion) {
    aiOutput.textContent = aiMessages[0];
  } else {
    let messageIndex = 0;
    let characterIndex = 0;

    const typeMessage = () => {
      const message = aiMessages[messageIndex];
      aiOutput.textContent = message.slice(0, characterIndex);
      characterIndex += 1;

      if (characterIndex <= message.length) {
        window.setTimeout(typeMessage, 54);
        return;
      }

      window.setTimeout(() => {
        messageIndex = (messageIndex + 1) % aiMessages.length;
        characterIndex = 0;
        typeMessage();
      }, 1900);
    };

    typeMessage();
  }
}

const clockElements = document.querySelectorAll("[data-local-time]");
const updateClock = () => {
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  clockElements.forEach((element) => {
    element.textContent = time;
  });
};

updateClock();
window.setInterval(updateClock, 1000);

const featuredCard = document.querySelector("[data-featured-campaign]");

if (featuredCard) {
  const featuredVisual = featuredCard.closest(".signal-visual");
  const featuredElements = {
    logo: featuredCard.querySelector("[data-featured-logo]"),
    platform: featuredCard.querySelector("[data-featured-platform]"),
    status: featuredCard.querySelector("[data-featured-status]"),
    activity: featuredCard.querySelector("[data-featured-activity]"),
    task: featuredCard.querySelector("[data-featured-task]"),
    description: featuredCard.querySelector("[data-featured-description]"),
    tags: featuredCard.querySelector("[data-featured-tags]"),
    link: featuredCard.querySelector("[data-featured-link]"),
    controls: featuredCard.querySelector("[data-featured-controls]"),
    dots: featuredCard.querySelector("[data-featured-dots]"),
    previous: featuredCard.querySelector("[data-featured-previous]"),
    next: featuredCard.querySelector("[data-featured-next]"),
  };
  const featuredState = { allCampaigns: [], campaigns: [], index: 0, timer: 0, paused: false };
  const platformNames = { binance: "Binance", okx: "OKX", bybit: "Bybit", bitget: "Bitget", gate: "Gate" };

  const validExternalUrl = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const isCurrentCampaign = (campaign, now = Date.now()) => {
    if (campaign.published === false) return false;
    const start = Date.parse(campaign.startsAt || "");
    const end = Date.parse(campaign.endAt || "");
    return (Number.isNaN(start) || start <= now) && (Number.isNaN(end) || end > now) && Boolean(validExternalUrl(campaign.sourceUrl));
  };

  const campaignStatus = (campaign) => {
    const end = Date.parse(campaign.endAt || "");
    if (Number.isNaN(end)) return "进行中";
    const days = Math.max(1, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
    return days <= 3 ? "即将结束" : `${days} 天后结束`;
  };

  const renderFeaturedCampaign = () => {
    const campaign = featuredState.campaigns[featuredState.index];
    if (!campaign) {
      featuredCard.hidden = true;
      featuredVisual?.classList.remove("has-campaign");
      return;
    }
    const platformKey = String(campaign.platformKey || "").toLowerCase();
    const platform = campaign.platform || platformNames[platformKey] || platformKey;
    const description = String(campaign.description || "").trim();
    const tags = [campaign.audience, ...(Array.isArray(campaign.tags) ? campaign.tags : [])]
      .map((tag) => String(tag || "").trim())
      .filter((tag, index, all) => tag && all.indexOf(tag) === index)
      .slice(0, 4);

    featuredElements.logo.src = `./assets/exchanges/${platformKey}.svg`;
    featuredElements.logo.alt = `${platform} Logo`;
    featuredElements.platform.textContent = platform;
    featuredElements.status.textContent = campaignStatus(campaign);
    featuredElements.activity.textContent = campaign.activity || "平台活动";
    featuredElements.task.textContent = campaign.task || "查看活动详情";
    featuredElements.description.textContent = description;
    featuredElements.description.hidden = !description;
    featuredElements.tags.replaceChildren(...tags.map((tag) => {
      const element = document.createElement("span");
      element.textContent = tag;
      return element;
    }));
    featuredElements.link.href = validExternalUrl(campaign.sourceUrl);
    featuredElements.controls.hidden = featuredState.campaigns.length < 2;
    featuredElements.dots.replaceChildren(...featuredState.campaigns.map((_, index) => {
      const dot = document.createElement("i");
      dot.classList.toggle("active", index === featuredState.index);
      return dot;
    }));
    featuredCard.hidden = false;
    featuredVisual?.classList.add("has-campaign");
  };

  const stopFeaturedRotation = () => {
    window.clearInterval(featuredState.timer);
    featuredState.timer = 0;
  };

  const startFeaturedRotation = () => {
    stopFeaturedRotation();
    if (reduceMotion || featuredState.paused || featuredState.campaigns.length < 2) return;
    featuredState.timer = window.setInterval(() => {
      featuredState.index = (featuredState.index + 1) % featuredState.campaigns.length;
      renderFeaturedCampaign();
    }, 7000);
  };

  const moveFeaturedCampaign = (direction) => {
    if (!featuredState.campaigns.length) return;
    featuredState.index = (featuredState.index + direction + featuredState.campaigns.length) % featuredState.campaigns.length;
    renderFeaturedCampaign();
    startFeaturedRotation();
  };

  const refreshCurrentFeaturedCampaigns = () => {
    const currentId = featuredState.campaigns[featuredState.index]?.id;
    featuredState.campaigns = featuredState.allCampaigns.filter((campaign) => isCurrentCampaign(campaign));
    const preservedIndex = featuredState.campaigns.findIndex((campaign) => campaign.id === currentId);
    featuredState.index = preservedIndex >= 0 ? preservedIndex : 0;
    renderFeaturedCampaign();
    startFeaturedRotation();
  };

  featuredElements.previous.addEventListener("click", () => moveFeaturedCampaign(-1));
  featuredElements.next.addEventListener("click", () => moveFeaturedCampaign(1));
  featuredCard.addEventListener("pointerenter", () => { featuredState.paused = true; stopFeaturedRotation(); });
  featuredCard.addEventListener("pointerleave", () => { featuredState.paused = false; startFeaturedRotation(); });
  featuredCard.addEventListener("focusin", () => { featuredState.paused = true; stopFeaturedRotation(); });
  featuredCard.addEventListener("focusout", (event) => {
    if (featuredCard.contains(event.relatedTarget)) return;
    featuredState.paused = false;
    startFeaturedRotation();
  });

  const loadFeaturedCampaigns = async () => {
    const sources = featuredState.allCampaigns.length ? ["./api/site-content"] : ["./api/site-content", "./data/site-content.json"];
    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json();
        featuredState.allCampaigns = payload.featuredCampaigns || [];
        refreshCurrentFeaturedCampaigns();
        return;
      } catch {
        // Try the local seed data when the dynamic endpoint is unavailable.
      }
    }
    if (!featuredState.allCampaigns.length) renderFeaturedCampaign();
  };

  loadFeaturedCampaigns();
  window.setInterval(refreshCurrentFeaturedCampaigns, 60 * 1000);
  window.setInterval(loadFeaturedCampaigns, 5 * 60 * 1000);
}

const canvas = document.querySelector("#signalCanvas");

if (canvas) {
  const context = canvas.getContext("2d");
  const visual = canvas.closest(".signal-visual");
  const colors = {
    blue: "#0b5cff",
    green: "#08a981",
    amber: "#f59e0b",
    link: "#9ebcf6",
  };
  const pointSeeds = Array.from({ length: 24 }, (_, index) => ({
    x: ((index * 47) % 101) / 100,
    y: ((index * 29 + 17) % 97) / 96,
    phase: index * 0.71,
    radius: 1.2 + (index % 3) * 0.55,
  }));
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let startTime = performance.now();

  const resizeCanvas = () => {
    if (!visual) return;
    const bounds = visual.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const bezierPoint = (start, controlA, controlB, end, progress) => {
    const inverse = 1 - progress;
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * controlA.x + 3 * inverse * progress ** 2 * controlB.x + progress ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * controlA.y + 3 * inverse * progress ** 2 * controlB.y + progress ** 3 * end.y,
    };
  };

  const drawFlowPath = (start, controlA, controlB, end, color, alpha = 0.34, widthValue = 1) => {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(controlA.x, controlA.y, controlB.x, controlB.y, end.x, end.y);
    context.strokeStyle = color.replace("1)", `${alpha})`);
    context.lineWidth = widthValue;
    context.stroke();
  };

  const drawFlowField = (time) => {
    const hasCampaign = visual?.classList.contains("has-campaign");
    const core = { x: width * (hasCampaign ? 0.34 : 0.5), y: height * (hasCampaign ? 0.5 : 0.5) };
    const sources = [
      { start: { x: -30, y: height * 0.35 }, bend: -54, color: "rgba(11, 92, 255, 1)", phase: 0.05 },
      { start: { x: width * 0.64, y: -24 }, bend: 78, color: "rgba(8, 169, 129, 1)", phase: 0.31 },
      { start: { x: width * 0.68, y: height + 28 }, bend: -74, color: "rgba(245, 158, 11, 1)", phase: 0.59 },
      { start: { x: width * 0.08, y: height + 18 }, bend: 52, color: "rgba(12, 159, 190, 1)", phase: 0.82 },
    ];

    sources.forEach((source, sourceIndex) => {
      for (let strand = 0; strand < 7; strand += 1) {
        const offset = (strand - 3) * 7;
        const start = { x: source.start.x, y: source.start.y + offset };
        const controlA = {
          x: start.x + (core.x - start.x) * 0.42,
          y: start.y + source.bend + Math.sin(time * 0.00045 + strand) * 8,
        };
        const controlB = {
          x: core.x - (sourceIndex === 0 ? 90 : 62),
          y: core.y + offset * 0.35,
        };
        drawFlowPath(start, controlA, controlB, core, source.color, 0.08 + (strand === 3 ? 0.23 : 0.05), strand === 3 ? 1.25 : 0.7);

        const progress = reduceMotion
          ? (strand + 1) / 8
          : (time * (0.000045 + sourceIndex * 0.000004) + strand * 0.14 + source.phase) % 1;
        const particle = bezierPoint(start, controlA, controlB, core, progress);
        context.beginPath();
        context.arc(particle.x, particle.y, strand === 3 ? 3 : 1.7, 0, Math.PI * 2);
        context.fillStyle = source.color;
        context.globalAlpha = 0.48 + (strand === 3 ? 0.34 : 0);
        context.fill();
        context.globalAlpha = 1;
      }
    });

    const outputEnd = { x: width + 35, y: height * 0.48 };
    for (let strand = 0; strand < 8; strand += 1) {
      const offset = (strand - 3.5) * 8;
      const controlA = { x: core.x + 80, y: core.y + offset * 0.25 };
      const controlB = { x: width * 0.78, y: outputEnd.y + offset + Math.sin(time * 0.0004 + strand) * 6 };
      const color = strand % 3 === 0 ? "rgba(8, 169, 129, 1)" : strand % 3 === 1 ? "rgba(11, 92, 255, 1)" : "rgba(245, 158, 11, 1)";
      drawFlowPath(core, controlA, controlB, { x: outputEnd.x, y: outputEnd.y + offset }, color, strand === 4 ? 0.24 : 0.07, strand === 4 ? 1.25 : 0.7);
    }
  };

  const drawNetwork = (time) => {
    const points = pointSeeds.map((seed) => ({
      x: seed.x * width + Math.sin(time * 0.00035 + seed.phase) * 14,
      y: seed.y * height + Math.cos(time * 0.00028 + seed.phase) * 10,
      ...seed,
    }));

    points.forEach((point, index) => {
      const pulse = 0.55 + Math.sin(time * 0.002 + point.phase) * 0.3;
      context.beginPath();
      context.arc(point.x, point.y, point.radius + pulse, 0, Math.PI * 2);
      context.fillStyle = index % 5 === 0 ? "rgba(8, 169, 129, 0.5)" : "rgba(11, 92, 255, 0.38)";
      context.fill();
    });
  };

  const drawScanner = (time) => {
    const scannerX = reduceMotion ? width * 0.66 : ((time * 0.055) % (width + 180)) - 90;
    const gradient = context.createLinearGradient(scannerX - 72, 0, scannerX + 72, 0);
    gradient.addColorStop(0, "rgba(8, 169, 129, 0)");
    gradient.addColorStop(0.46, "rgba(8, 169, 129, 0.035)");
    gradient.addColorStop(0.5, "rgba(8, 169, 129, 0.16)");
    gradient.addColorStop(0.54, "rgba(8, 169, 129, 0.035)");
    gradient.addColorStop(1, "rgba(8, 169, 129, 0)");
    context.fillStyle = gradient;
    context.fillRect(scannerX - 72, 0, 144, height);
    context.fillStyle = "rgba(8, 169, 129, 0.36)";
    context.fillRect(scannerX, 0, 1, height);
  };

  const render = (time) => {
    context.clearRect(0, 0, width, height);
    const elapsed = reduceMotion ? 2800 : time - startTime;

    drawScanner(elapsed);
    drawNetwork(elapsed);
    drawFlowField(elapsed);

    if (!reduceMotion) animationFrame = window.requestAnimationFrame(render);
  };

  resizeCanvas();
  render(performance.now());

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
    if (reduceMotion) render(performance.now());
  });
  if (visual) resizeObserver.observe(visual);

  document.addEventListener("visibilitychange", () => {
    if (reduceMotion) return;
    if (document.hidden) {
      window.cancelAnimationFrame(animationFrame);
    } else {
      startTime = performance.now();
      animationFrame = window.requestAnimationFrame(render);
    }
  });
}

