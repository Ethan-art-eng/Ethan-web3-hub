(() => {
  const scriptUrl = document.currentScript?.src || window.location.href;
  const siteRoot = new URL(".", scriptUrl);
  const header = document.querySelector(".site-header");
  const community = header?.querySelector(".community-links");
  if (!header || !community || document.getElementById("globalSearchDialog")) return;

  const resolveSiteUrl = (path) => new URL(String(path || "").replace(/^\//, ""), siteRoot).href;
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const actions = document.createElement("div");
  actions.className = "header-actions";
  community.before(actions);
  actions.append(community);

  const openButton = document.createElement("button");
  openButton.className = "global-search-trigger";
  openButton.type = "button";
  openButton.innerHTML = '<span aria-hidden="true">⌕</span><b>搜索</b><kbd>⌘ K</kbd>';
  openButton.setAttribute("aria-label", "打开全站搜索");
  actions.prepend(openButton);

  const mobileToggle = document.createElement("button");
  mobileToggle.className = "mobile-nav-toggle";
  mobileToggle.type = "button";
  mobileToggle.setAttribute("aria-label", "打开导航菜单");
  mobileToggle.setAttribute("aria-expanded", "false");
  mobileToggle.setAttribute("aria-controls", "mobileNavPanel");
  mobileToggle.innerHTML = '<span aria-hidden="true"></span>';
  actions.append(mobileToggle);

  const mobilePanel = document.createElement("div");
  mobilePanel.className = "mobile-nav-panel";
  mobilePanel.id = "mobileNavPanel";
  mobilePanel.hidden = true;
  const mobileNav = header.querySelector(".nav")?.cloneNode(true);
  const mobileCommunity = community.cloneNode(true);
  mobileNav?.classList.add("mobile-nav");
  mobileCommunity.classList.add("mobile-community");
  if (mobileNav) mobilePanel.append(mobileNav);
  mobilePanel.append(mobileCommunity);
  header.append(mobilePanel);

  function setMobileMenu(open) {
    header.classList.toggle("menu-open", open);
    mobilePanel.hidden = !open;
    mobileToggle.setAttribute("aria-expanded", String(open));
    mobileToggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
  }

  mobileToggle.addEventListener("click", () => setMobileMenu(!header.classList.contains("menu-open")));
  mobilePanel.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMobileMenu(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setMobileMenu(false);
  });

  const dialog = document.createElement("dialog");
  dialog.className = "global-search-dialog";
  dialog.id = "globalSearchDialog";
  dialog.innerHTML = `
    <div class="global-search-panel">
      <div class="global-search-head">
        <label for="globalSearchInput"><span aria-hidden="true">⌕</span><input id="globalSearchInput" type="search" placeholder="搜索空投、工具、教程或理财活动" autocomplete="off" /></label>
        <button type="button" class="global-search-close" aria-label="关闭搜索">关闭</button>
      </div>
      <p class="global-search-status" id="globalSearchStatus">输入关键词开始搜索</p>
      <div class="global-search-results" id="globalSearchResults"></div>
      <div class="global-search-foot"><span>Enter 打开</span><span>Esc 关闭</span></div>
    </div>`;
  document.body.append(dialog);

  const input = dialog.querySelector("#globalSearchInput");
  const results = dialog.querySelector("#globalSearchResults");
  const status = dialog.querySelector("#globalSearchStatus");
  const closeButton = dialog.querySelector(".global-search-close");
  let searchIndex = [
    { type: "板块", title: "空投项目", description: "按年份和状态追踪项目", href: resolveSiteUrl("airdrops/") },
    { type: "板块", title: "教程", description: "钱包安全、链上基础、DeFi 与项目研究", href: resolveSiteUrl("courses/") },
    { type: "板块", title: "工具箱", description: "网络、数据、空投和安全工具", href: resolveSiteUrl("toolbox/") },
    { type: "板块", title: "币圈理财", description: "五家交易所稳定币活动", href: resolveSiteUrl("wealth/") },
  ];
  let loaded = false;

  const tutorialPaths = {
    "tutorial-01": "courses/wallet-security/",
    "tutorial-02": "courses/onchain-basics/",
    "tutorial-03": "courses/defi-basics/",
    "tutorial-04": "courses/project-research/",
  };

  async function fetchJson(apiPath, fallbackPath) {
    for (const path of [apiPath, fallbackPath]) {
      try {
        const response = await fetch(resolveSiteUrl(path), { cache: "no-store" });
        if (response.ok) return response.json();
      } catch {
        // Keep the built-in section results when a local file preview cannot fetch data.
      }
    }
    return null;
  }

  async function loadIndex() {
    if (loaded) return;
    loaded = true;
    status.textContent = "正在读取全站内容";
    const [airdrops, siteContent, wealth] = await Promise.all([
      fetchJson("api/airdrop-projects", "data/airdrop-projects.json"),
      fetchJson("api/site-content", "data/site-content.json"),
      fetchJson("api/cex-yields", "data/cex-yields.json"),
    ]);

    if (Array.isArray(airdrops?.projects)) {
      searchIndex.push(...airdrops.projects.map((item) => ({
        type: "空投",
        title: item.name,
        description: [item.category, item.status, item.investors].filter(Boolean).join(" · "),
        keywords: [item.note, item.funding, item.cost].filter(Boolean).join(" "),
        href: `${resolveSiteUrl("airdrops/")}?year=${encodeURIComponent(item.year || "2026")}&q=${encodeURIComponent(item.name)}`,
      })));
    }

    if (siteContent) {
      for (const group of siteContent.toolGroups || []) {
        searchIndex.push(...(group.items || []).map((item) => ({
          type: "工具",
          title: item.name,
          description: `${group.title} · ${item.description || "工具入口"}`,
          keywords: `${group.label} ${group.title}`,
          href: `${resolveSiteUrl("toolbox/")}?q=${encodeURIComponent(item.name)}`,
        })));
      }
      searchIndex.push(...(siteContent.tutorials || []).map((item) => ({
        type: "教程",
        title: item.title,
        description: item.description,
        keywords: item.audience,
        href: item.url ? resolveSiteUrl(item.url) : resolveSiteUrl(tutorialPaths[item.id] || "courses/"),
      })));
    }

    if (Array.isArray(wealth?.campaigns)) {
      searchIndex.push(...wealth.campaigns.map((item) => ({
        type: "理财",
        title: item.activity,
        description: `${item.venue || item.exchange} · ${item.apy || "利率待核验"}`,
        keywords: `${item.exchange} ${item.eligibility || ""} ${item.productType || ""}`,
        href: `${resolveSiteUrl("wealth/")}?q=${encodeURIComponent(item.activity)}`,
      })));
    }
    status.textContent = "输入关键词开始搜索";
  }

  function renderResults(query) {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    if (!keyword) {
      results.innerHTML = searchIndex.slice(0, 4).map(renderResult).join("");
      status.textContent = "常用板块";
      return;
    }
    const matches = searchIndex.filter((item) => `${item.title} ${item.description} ${item.keywords || ""}`.toLocaleLowerCase("zh-CN").includes(keyword)).slice(0, 16);
    status.textContent = matches.length ? `找到 ${matches.length} 个相关结果` : "没有找到匹配内容";
    results.innerHTML = matches.length
      ? matches.map(renderResult).join("")
      : '<div class="global-search-empty"><strong>换一个关键词试试</strong><span>可搜索项目名、工具名、交易所、币种或教程主题。</span></div>';
  }

  function renderResult(item) {
    return `<a class="global-search-result" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.type)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || "打开查看")}</small></div><b aria-hidden="true">→</b></a>`;
  }

  function openSearch() {
    setMobileMenu(false);
    if (!dialog.open) dialog.showModal();
    loadIndex().then(() => renderResults(input.value));
    window.setTimeout(() => input.focus(), 0);
  }

  openButton.addEventListener("click", openSearch);
  closeButton.addEventListener("click", () => dialog.close());
  input.addEventListener("input", () => renderResults(input.value));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("menu-open")) setMobileMenu(false);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
})();
