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
