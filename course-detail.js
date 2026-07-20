(() => {
  const courseId = document.body.dataset.courseId;
  const nextNavigation = document.querySelector(".tutorial-next");
  if (!courseId || !nextNavigation) return;

  const updatedAt = document.body.dataset.updatedAt || "2026-07-20";
  const lessonNumber = Number(courseId.match(/analysis-(\d+)-/)?.[1] || 0);
  const level = lessonNumber >= 22 ? "进阶" : "入门";
  const hero = document.querySelector(".tutorial-hero");
  const placeholderCommunity = document.querySelector(".community-links");
  if (placeholderCommunity) {
    const memberLink = document.createElement("a");
    memberLink.className = "tutorial-detail-member-link";
    memberLink.href = new URL("/members/", location.origin).href;
    memberLink.textContent = "会员学习区";
    placeholderCommunity.replaceWith(memberLink);
  }
  const description = hero?.querySelector("h1 + p");
  if (description && !hero.querySelector(".tutorial-trust-meta")) {
    const trustMeta = document.createElement("div");
    trustMeta.className = "tutorial-trust-meta";
    trustMeta.innerHTML = `<span><strong>整理</strong>Ethan</span><span><strong>更新</strong>${updatedAt}</span><span><strong>难度</strong>${level}</span><span><strong>用途</strong>教育与研究</span>`;
    description.after(trustMeta);
  }

  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const title = document.querySelector("h1")?.textContent?.trim() || document.title;
  const summary = document.querySelector('meta[name="description"]')?.content || "";
  const heroImage = document.querySelector(".tutorial-hero-figure img")?.src;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: summary,
      mainEntityOfPage: canonical,
      datePublished: updatedAt,
      dateModified: updatedAt,
      author: { "@type": "Person", name: "Ethan" },
      publisher: { "@type": "Organization", name: "躺赚笔记", url: new URL("/", location.origin).href },
      ...(heroImage ? { image: heroImage } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首页", item: new URL("/", location.origin).href },
        { "@type": "ListItem", position: 2, name: "教程", item: new URL("/courses/", location.origin).href },
        { "@type": "ListItem", position: 3, name: title, item: canonical },
      ],
    },
  ];
  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.textContent = JSON.stringify(structuredData);
  document.head.append(schema);

  const modifiedMeta = document.createElement("meta");
  modifiedMeta.setAttribute("property", "article:modified_time");
  modifiedMeta.content = `${updatedAt}T00:00:00+08:00`;
  document.head.append(modifiedMeta);

  const storageKey = "ethan-course-progress-v1";
  const readProgress = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      return new Set(Array.isArray(value) ? value.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  };

  const button = document.createElement("button");
  button.className = "tutorial-complete-toggle";
  button.type = "button";

  const updateButton = () => {
    const completed = readProgress().has(courseId);
    button.setAttribute("aria-pressed", String(completed));
    button.textContent = completed ? "已完成这篇 ✓" : "读完了，标记完成";
  };

  button.addEventListener("click", () => {
    const progress = readProgress();
    if (progress.has(courseId)) progress.delete(courseId);
    else progress.add(courseId);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(progress)));
    } catch (error) {
      console.warn("无法保存教程进度。", error);
    }
    updateButton();
  });

  nextNavigation.before(button);
  updateButton();
})();
