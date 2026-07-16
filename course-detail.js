(() => {
  const courseId = document.body.dataset.courseId;
  const nextNavigation = document.querySelector(".tutorial-next");
  if (!courseId || !nextNavigation) return;

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
    button.textContent = completed ? "本章已完成 ✓" : "标记本章完成";
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
