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

  const waveY = (x, baseline, amplitude, frequency, phase) =>
    baseline + Math.sin(x * frequency + phase) * amplitude + Math.sin(x * frequency * 0.43 - phase * 0.7) * amplitude * 0.24;

  const drawWave = ({ baseline, amplitude, frequency, phase, color }) => {
    context.beginPath();
    for (let x = -8; x <= width + 8; x += 6) {
      const y = waveY(x, baseline, amplitude, frequency, phase);
      if (x === -8) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = color;
    context.lineWidth = 2.1;
    context.shadowColor = color;
    context.shadowBlur = 6;
    context.stroke();
    context.shadowBlur = 0;
  };

  const drawNetwork = (time) => {
    const points = pointSeeds.map((seed) => ({
      x: seed.x * width + Math.sin(time * 0.00035 + seed.phase) * 14,
      y: seed.y * height + Math.cos(time * 0.00028 + seed.phase) * 10,
      ...seed,
    }));

    context.lineWidth = 0.8;
    points.forEach((point, index) => {
      const partner = points[(index * 7 + 5) % points.length];
      const distance = Math.hypot(point.x - partner.x, point.y - partner.y);
      if (distance < Math.max(width, height) * 0.34) {
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(partner.x, partner.y);
        context.strokeStyle = "rgba(76, 126, 218, 0.16)";
        context.stroke();
      }
    });

    points.forEach((point, index) => {
      const pulse = 0.55 + Math.sin(time * 0.002 + point.phase) * 0.3;
      context.beginPath();
      context.arc(point.x, point.y, point.radius + pulse, 0, Math.PI * 2);
      context.fillStyle = index % 5 === 0 ? "rgba(8, 169, 129, 0.72)" : "rgba(11, 92, 255, 0.58)";
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

  const drawParticles = (time, waves) => {
    waves.forEach((wave, waveIndex) => {
      for (let index = 0; index < 4; index += 1) {
        const progress = reduceMotion
          ? (index + 1) / 5
          : ((time * (0.000035 + waveIndex * 0.000004) + index * 0.27 + waveIndex * 0.13) % 1);
        const x = progress * width;
        const y = waveY(x, wave.baseline, wave.amplitude, wave.frequency, wave.phase);
        context.beginPath();
        context.arc(x, y, index === 0 ? 3.2 : 2, 0, Math.PI * 2);
        context.fillStyle = wave.color;
        context.shadowColor = wave.color;
        context.shadowBlur = 10;
        context.fill();
        context.shadowBlur = 0;
      }
    });
  };

  const render = (time) => {
    context.clearRect(0, 0, width, height);
    const elapsed = reduceMotion ? 2800 : time - startTime;
    const waves = [
      { baseline: height * 0.36, amplitude: Math.max(20, height * 0.07), frequency: 0.009, phase: elapsed * 0.00032, color: colors.blue },
      { baseline: height * 0.57, amplitude: Math.max(18, height * 0.06), frequency: 0.008, phase: elapsed * 0.00025 + 1.8, color: colors.green },
      { baseline: height * 0.73, amplitude: Math.max(14, height * 0.045), frequency: 0.01, phase: elapsed * 0.00021 + 3.3, color: colors.amber },
    ];

    drawScanner(elapsed);
    drawNetwork(elapsed);
    waves.forEach(drawWave);
    drawParticles(elapsed, waves);

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
