const canvas = document.getElementById("signalCanvas");

if (canvas) {
  const context = canvas.getContext("2d");
  const board = document.querySelector(".signal-board");
  const controls = document.querySelectorAll("[data-signal-view]");
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let phase = 0;
  let view = "all";
  let points = [];

  const resize = () => {
    const rectangle = canvas.getBoundingClientRect();
    width = rectangle.width;
    height = rectangle.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    points = Array.from({ length: 26 }, (_, index) => ({
      x: (index / 25) * width,
      y: height * (.22 + Math.random() * .56),
      seed: Math.random() * 20
    }));
  };

  const drawLine = (offset, color, amplitude, speed) => {
    context.beginPath();
    for (let x = 0; x <= width; x += 5) {
      const y = height * offset + Math.sin(x * .015 + phase * speed) * amplitude + Math.cos(x * .006 - phase) * 18;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
  };

  const draw = () => {
    phase += .018;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(100,116,139,.14)";
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

    if (view === "all" || view === "crypto") {
      drawLine(.38, "#0b5cff", 28, 1.4);
      drawLine(.56, "#08a981", 24, 1.05);
    }
    if (view === "all" || view === "equity") drawLine(.70, "#f59e0b", 18, .75);

    points.forEach((point, index) => {
      point.y += Math.sin(phase + point.seed) * .12;
      if (index < points.length - 1 && index % 2 === 0) {
        const next = points[index + 1];
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(next.x, next.y);
        context.strokeStyle = "rgba(37,99,235,.18)";
        context.stroke();
      }
      context.beginPath();
      context.arc(point.x, point.y, index % 7 === 0 ? 3 : 1.4, 0, Math.PI * 2);
      context.fillStyle = index % 7 === 0 ? "#08a981" : "#0b5cff";
      context.fill();
    });

    const scanX = (phase * 78) % width;
    context.fillStyle = "rgba(11,92,255,.035)";
    context.fillRect(scanX - 20, 0, 40, height);
    context.strokeStyle = "rgba(11,92,255,.28)";
    context.beginPath();
    context.moveTo(scanX, 0);
    context.lineTo(scanX, height);
    context.stroke();
    window.requestAnimationFrame(draw);
  };

  controls.forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.signalView;
      board.dataset.view = view;
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

if (aiOutput) {
  const messages = [
    "正在关联链上活动、市场叙事与官方来源…",
    "发现跨市场信号，正在核验信息来源…",
    "已建立主流币与 AI 科技资产观察关系…"
  ];
  let messageIndex = 0;
  let characterIndex = 0;

  const typeMessage = () => {
    const message = messages[messageIndex];
    aiOutput.textContent = message.slice(0, characterIndex);
    characterIndex += 1;
    if (characterIndex <= message.length) {
      window.setTimeout(typeMessage, 48);
      return;
    }
    window.setTimeout(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      characterIndex = 0;
      typeMessage();
    }, 1700);
  };

  typeMessage();
}

const lastSync = document.querySelector("[data-last-sync]");

if (lastSync) {
  const updateClock = () => {
    lastSync.textContent = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  };
  updateClock();
  window.setInterval(updateClock, 1000);
}
