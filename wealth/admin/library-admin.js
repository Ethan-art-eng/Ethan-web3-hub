const LIBRARY_API = "/wealth/admin/api/content-library";
const libraryState = { data: null, articleId: null, courseId: null, lessonId: null, memberId: null, memberQuery: "", memberFilter: "all" };
const $ = (id) => document.getElementById(id);

function dateInput(value) { return value ? String(value).slice(0, 10) : ""; }
function isoDate(value, endOfDay = false) { return value ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}.000Z` : null; }
function expired(member) { return Boolean(member.expires_at && Date.parse(member.expires_at) <= Date.now()); }
function memberIsActive(member) { return member.status === "active" && !expired(member); }
function labelLevel(value) { return value === "premium" ? "高级会员" : value === "basic" ? "正式会员" : value === "member" ? "会员专享" : "公开 / 试看"; }

function renderLibrary() {
  if (!libraryState.data) return;
  const { escapeHtml } = window.adminConsole;
  const { articles, courses, lessons, members } = libraryState.data;
  const publishedArticles = articles.filter((item) => item.status === "published");
  $("articleTotal").textContent = articles.length;
  $("articlePublished").textContent = publishedArticles.length;
  $("articleDraft").textContent = articles.length - publishedArticles.length;
  $("overviewArticleCount").textContent = publishedArticles.length;
  $("articleAdminEmpty").hidden = articles.length > 0;
  $("articleAdminBody").innerHTML = articles.map((item) => `<tr><td><div class="cell-stack"><strong>${escapeHtml(item.title)}</strong><span>/articles/${escapeHtml(item.slug)}/</span></div></td><td>${escapeHtml(item.category)}</td><td><span class="admin-badge ${item.access_level === "member" ? "ending" : "published"}">${item.access_level === "member" ? "会员" : "公开"}</span></td><td><span class="admin-badge ${item.status === "published" ? "published" : "draft"}">${item.status === "published" ? "已发布" : "草稿"}</span></td><td><div class="row-actions">${item.status === "published" ? `<a class="admin-link-inline" href="/articles/${escapeHtml(item.slug)}/" target="_blank">查看</a>` : ""}<button data-article-edit="${escapeHtml(item.id)}">编辑</button><button class="delete-button" data-article-delete="${escapeHtml(item.id)}">删除</button></div></td></tr>`).join("");

  $("courseTotal").textContent = courses.length;
  $("overviewCourseCount").textContent = courses.filter((item) => item.status === "published").length;
  $("lessonPublished").textContent = lessons.filter((item) => item.status === "published").length;
  $("lessonDraft").textContent = lessons.filter((item) => item.status !== "published").length;
  $("courseAdminList").innerHTML = courses.length ? courses.map((course) => {
    const courseLessons = lessons.filter((lesson) => lesson.course_id === course.id);
    return `<article class="course-admin-card"><header><div><span class="admin-badge ${course.status === "published" ? "published" : "draft"}">${course.status === "published" ? "已发布" : "草稿"}</span><small>${labelLevel(course.access_level)}</small><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || "暂未填写简介")}</p></div><div class="row-actions"><button data-course-edit="${escapeHtml(course.id)}">编辑课程</button><button class="delete-button" data-course-delete="${escapeHtml(course.id)}">删除</button></div></header><div class="course-lesson-list">${courseLessons.length ? courseLessons.map((lesson, index) => `<div><span><i>${String(index + 1).padStart(2, "0")}</i><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.stream_uid ? "视频已连接" : "等待上传视频"} · ${lesson.access_level === "free" ? "免费试看" : "跟随课程权限"}</small></span><em class="admin-badge ${lesson.status === "published" ? "published" : "draft"}">${lesson.status === "published" ? "已发布" : "草稿"}</em><div class="row-actions"><button data-lesson-edit="${escapeHtml(lesson.id)}">编辑</button><button class="delete-button" data-lesson-delete="${escapeHtml(lesson.id)}">删除</button></div></div>`).join("") : '<p class="admin-empty">还没有课时。</p>'}</div></article>`;
  }).join("") : '<p class="admin-empty">还没有课程，先创建第一门课程。</p>';

  const activeMembers = members.filter(memberIsActive);
  $("memberTotal").textContent = members.length;
  $("memberActive").textContent = activeMembers.length;
  $("memberInactive").textContent = members.length - activeMembers.length;
  $("overviewMemberCount").textContent = activeMembers.length;
  const query = libraryState.memberQuery.toLowerCase();
  const visible = members.filter((member) => (!query || `${member.email} ${member.name}`.toLowerCase().includes(query)) && (libraryState.memberFilter === "all" || (libraryState.memberFilter === "active") === memberIsActive(member)));
  $("memberAdminEmpty").hidden = visible.length > 0;
  $("memberAdminBody").innerHTML = visible.map((member) => {
    const active = memberIsActive(member);
    const expiry = member.expires_at ? dateInput(member.expires_at) : "长期有效";
    return `<tr><td><div class="cell-stack"><strong>${escapeHtml(member.name || "未命名会员")}</strong><span>${escapeHtml(member.email)}</span></div></td><td>${labelLevel(member.tier)}</td><td>${escapeHtml(expiry)}</td><td><span class="admin-badge ${active ? "published" : "ended"}">${active ? "有效" : expired(member) ? "已到期" : "已暂停"}</span></td><td><div class="row-actions"><button data-member-edit="${escapeHtml(member.id)}">编辑</button><button data-member-revoke="${escapeHtml(member.id)}">强制下线</button><button class="delete-button" data-member-delete="${escapeHtml(member.id)}">删除</button></div></td></tr>`;
  }).join("");
}

async function loadLibrary() {
  try { libraryState.data = await window.adminConsole.apiRequest(LIBRARY_API); renderLibrary(); }
  catch (error) { window.adminConsole.setStatus($("articleSaveStatus"), error.message, "error"); }
}

async function saveResource(resource, record, statusElement, message) {
  window.adminConsole.setStatus(statusElement, "正在保存…");
  const result = await window.adminConsole.apiRequest(LIBRARY_API, { method: "PUT", body: JSON.stringify({ resource, record }) });
  libraryState.data = result.data; renderLibrary(); window.adminConsole.setStatus(statusElement, message, "success");
}

async function deleteResource(resource, id, statusElement, name) {
  if (!confirm(`确定删除“${name}”吗？`)) return;
  const result = await window.adminConsole.apiRequest(`${LIBRARY_API}?resource=${resource}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
  libraryState.data = result.data; renderLibrary(); window.adminConsole.setStatus(statusElement, "已删除。", "success");
}

async function revokeMemberSessions(member) {
  if (!confirm(`确定让“${member.email}”在所有设备退出登录吗？`)) return;
  window.adminConsole.setStatus($("memberSaveStatus"), "正在退出该会员的设备…");
  await window.adminConsole.apiRequest("/wealth/admin/api/member-sessions", {
    method: "POST",
    body: JSON.stringify({ memberId: member.id }),
  });
  window.adminConsole.setStatus($("memberSaveStatus"), "该会员已在所有设备退出登录。", "success");
}

function openArticle(item = null) {
  libraryState.articleId = item?.id || null; $("articleDialogTitle").textContent = item ? "编辑文章" : "新建文章"; $("articleForm").reset();
  $("articleTitle").value = item?.title || ""; $("articleSlug").value = item?.slug || ""; $("articleCategory").value = item?.category || "投资基础"; $("articleExcerpt").value = item?.excerpt || ""; $("articleCoverUrl").value = item?.cover_url || ""; $("articleReadingMinutes").value = item?.reading_minutes || 5; $("articleAccess").value = item?.access_level || "public"; $("articleStatus").value = item?.status || "draft"; $("articleBody").innerHTML = item?.body_html || "<p>从这里开始写正文…</p>"; $("articleDialog").showModal();
}
function openCourse(item = null) {
  libraryState.courseId = item?.id || null; $("courseDialogTitle").textContent = item ? "编辑课程" : "新建课程"; $("courseForm").reset();
  $("courseTitle").value = item?.title || ""; $("courseSlug").value = item?.slug || ""; $("courseDescription").value = item?.description || ""; $("courseCoverUrl").value = item?.cover_url || ""; $("courseAccess").value = item?.access_level || "basic"; $("courseSortOrder").value = item?.sort_order || 0; $("courseStatus").value = item?.status || "draft"; $("courseDialog").showModal();
}
function openLesson(item = null) {
  if (!libraryState.data.courses.length) { window.adminConsole.setStatus($("courseSaveStatus"), "请先创建一门课程。", "error"); return; }
  libraryState.lessonId = item?.id || null; $("lessonDialogTitle").textContent = item ? "编辑课时" : "新增课时"; $("lessonForm").reset();
  $("lessonCourseId").innerHTML = libraryState.data.courses.map((course) => `<option value="${window.adminConsole.escapeHtml(course.id)}">${window.adminConsole.escapeHtml(course.title)}</option>`).join("");
  $("lessonCourseId").value = item?.course_id || libraryState.data.courses[0].id; $("lessonTitle").value = item?.title || ""; $("lessonDescription").value = item?.description || ""; $("lessonStreamUid").value = item?.stream_uid || ""; $("lessonDuration").value = item?.duration_minutes || ""; $("lessonAccess").value = item?.access_level || "member"; $("lessonSortOrder").value = item?.sort_order || 0; $("lessonStatus").value = item?.status || "draft"; $("videoUploadProgress").hidden = true; $("lessonDialog").showModal();
}
function openMember(item = null) {
  libraryState.memberId = item?.id || null; $("memberDialogTitle").textContent = item ? "编辑会员" : "新增会员"; $("memberForm").reset();
  $("memberEmail").value = item?.email || ""; $("memberName").value = item?.name || ""; $("memberTier").value = item?.tier || "basic"; $("memberStatusInput").value = item?.status || "active"; $("memberStartsAt").value = dateInput(item?.starts_at) || new Date().toISOString().slice(0, 10); $("memberExpiresAt").value = dateInput(item?.expires_at); $("memberAccessCode").value = ""; $("memberNotes").value = item?.notes || ""; $("memberDialog").showModal();
}

async function uploadImage(file) {
  const form = new FormData(); form.append("file", file);
  const response = await fetch("/wealth/admin/api/media-upload", { method: "POST", headers: { authorization: `Bearer ${window.adminConsole.getToken()}` }, body: form });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "图片上传失败"); return data.url;
}

async function uploadVideo(file, name) {
  if (file.size > 200 * 1024 * 1024) throw new Error("网页直传暂时支持 200MB 以内的视频；更大的文件可先在 Cloudflare Stream 上传，再填写视频 ID。");
  let provision;
  try {
    provision = await window.adminConsole.apiRequest("/wealth/admin/api/stream-upload", { method: "POST", body: JSON.stringify({ name, maxDurationSeconds: 21600 }) });
  } catch (error) {
    if (/Stream not enabled|尚未启用|Authorization Failure/i.test(error.message)) throw new Error("Cloudflare Stream 尚未开通。请先把视频上传到 B站、腾讯视频、优酷、YouTube 或 Vimeo，再将视频地址粘贴到下方输入框。");
    throw error;
  }
  const form = new FormData(); form.append("file", file);
  const response = await fetch(provision.uploadURL, { method: "POST", body: form });
  if (!response.ok) throw new Error("视频上传失败，请检查网络后重试。");
  return provision.id;
}

$("addArticleButton").addEventListener("click", () => openArticle()); $("closeArticleDialog").addEventListener("click", () => $("articleDialog").close()); $("cancelArticleDialog").addEventListener("click", () => $("articleDialog").close());
$("articleForm").addEventListener("submit", async (event) => { event.preventDefault(); try { let cover = $("articleCoverUrl").value.trim(); const file = $("articleCoverFile").files[0]; if (file) { window.adminConsole.setStatus($("articleSaveStatus"), "正在上传封面…"); cover = await uploadImage(file); } const existing = libraryState.data.articles.find((item) => item.id === libraryState.articleId); await saveResource("article", { ...existing, id: libraryState.articleId, title: $("articleTitle").value, slug: $("articleSlug").value, category: $("articleCategory").value, excerpt: $("articleExcerpt").value, cover_url: cover, body_html: $("articleBody").innerHTML, reading_minutes: $("articleReadingMinutes").value, access_level: $("articleAccess").value, status: $("articleStatus").value }, $("articleSaveStatus"), "文章已保存。"); $("articleDialog").close(); } catch (error) { window.adminConsole.setStatus($("articleSaveStatus"), error.message, "error"); } });
$("articleAdminBody").addEventListener("click", (event) => { const edit = event.target.closest("[data-article-edit]"); if (edit) openArticle(libraryState.data.articles.find((item) => item.id === edit.dataset.articleEdit)); const del = event.target.closest("[data-article-delete]"); if (del) { const item = libraryState.data.articles.find((entry) => entry.id === del.dataset.articleDelete); deleteResource("article", item.id, $("articleSaveStatus"), item.title); } });
document.querySelectorAll("[data-editor-command]").forEach((button) => button.addEventListener("click", () => { $("articleBody").focus(); document.execCommand(button.dataset.editorCommand, false, button.dataset.editorValue || null); }));
$("articleInsertLink").addEventListener("click", () => { const url = prompt("请输入链接地址（https://…）"); if (url && /^https?:\/\//i.test(url)) { $("articleBody").focus(); document.execCommand("createLink", false, url); } });
$("articleInsertImage").addEventListener("click", async () => { const picker = document.createElement("input"); picker.type = "file"; picker.accept = "image/*"; picker.onchange = async () => { try { const url = await uploadImage(picker.files[0]); $("articleBody").focus(); document.execCommand("insertImage", false, url); } catch (error) { window.adminConsole.setStatus($("articleSaveStatus"), error.message, "error"); } }; picker.click(); });

$("addCourseButton").addEventListener("click", () => openCourse()); $("closeCourseDialog").addEventListener("click", () => $("courseDialog").close()); $("cancelCourseDialog").addEventListener("click", () => $("courseDialog").close());
$("courseForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const existing = libraryState.data.courses.find((item) => item.id === libraryState.courseId); await saveResource("course", { ...existing, id: libraryState.courseId, title: $("courseTitle").value, slug: $("courseSlug").value, description: $("courseDescription").value, cover_url: $("courseCoverUrl").value, access_level: $("courseAccess").value, sort_order: $("courseSortOrder").value, status: $("courseStatus").value }, $("courseSaveStatus"), "课程已保存。"); $("courseDialog").close(); } catch (error) { window.adminConsole.setStatus($("courseSaveStatus"), error.message, "error"); } });
$("addLessonButton").addEventListener("click", () => openLesson()); $("closeLessonDialog").addEventListener("click", () => $("lessonDialog").close()); $("cancelLessonDialog").addEventListener("click", () => $("lessonDialog").close());
$("lessonForm").addEventListener("submit", async (event) => { event.preventDefault(); const save = $("saveLessonButton"); save.disabled = true; try { let uid = $("lessonStreamUid").value.trim(); const video = $("lessonVideoFile").files[0]; if (video) { $("videoUploadProgress").hidden = false; uid = await uploadVideo(video, $("lessonTitle").value); $("lessonStreamUid").value = uid; } const existing = libraryState.data.lessons.find((item) => item.id === libraryState.lessonId); await saveResource("lesson", { ...existing, id: libraryState.lessonId, course_id: $("lessonCourseId").value, title: $("lessonTitle").value, description: $("lessonDescription").value, stream_uid: uid, duration_minutes: $("lessonDuration").value, access_level: $("lessonAccess").value, sort_order: $("lessonSortOrder").value, status: $("lessonStatus").value }, $("courseSaveStatus"), "课时已保存。"); $("lessonDialog").close(); } catch (error) { window.adminConsole.setStatus($("courseSaveStatus"), error.message, "error"); } finally { save.disabled = false; $("videoUploadProgress").hidden = true; } });
$("courseAdminList").addEventListener("click", (event) => { let button = event.target.closest("[data-course-edit]"); if (button) openCourse(libraryState.data.courses.find((item) => item.id === button.dataset.courseEdit)); button = event.target.closest("[data-course-delete]"); if (button) { const item = libraryState.data.courses.find((entry) => entry.id === button.dataset.courseDelete); deleteResource("course", item.id, $("courseSaveStatus"), item.title); } button = event.target.closest("[data-lesson-edit]"); if (button) openLesson(libraryState.data.lessons.find((item) => item.id === button.dataset.lessonEdit)); button = event.target.closest("[data-lesson-delete]"); if (button) { const item = libraryState.data.lessons.find((entry) => entry.id === button.dataset.lessonDelete); deleteResource("lesson", item.id, $("courseSaveStatus"), item.title); } });

$("addMemberButton").addEventListener("click", () => openMember()); $("closeMemberDialog").addEventListener("click", () => $("memberDialog").close()); $("cancelMemberDialog").addEventListener("click", () => $("memberDialog").close());
$("generateMemberCode").addEventListener("click", () => { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; const bytes = crypto.getRandomValues(new Uint8Array(14)); $("memberAccessCode").value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(""); $("memberAccessCode").select(); });
$("memberForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const existing = libraryState.data.members.find((item) => item.id === libraryState.memberId); await saveResource("member", { ...existing, id: libraryState.memberId, email: $("memberEmail").value, name: $("memberName").value, tier: $("memberTier").value, status: $("memberStatusInput").value, starts_at: isoDate($("memberStartsAt").value), expires_at: isoDate($("memberExpiresAt").value, true), access_code: $("memberAccessCode").value, notes: $("memberNotes").value }, $("memberSaveStatus"), "会员权限已保存。请将刚设置的登录码安全发送给会员。" ); $("memberDialog").close(); } catch (error) { window.adminConsole.setStatus($("memberSaveStatus"), error.message, "error"); } });
$("memberAdminBody").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-member-edit]");
  if (edit) openMember(libraryState.data.members.find((item) => item.id === edit.dataset.memberEdit));
  const revoke = event.target.closest("[data-member-revoke]");
  if (revoke) {
    const item = libraryState.data.members.find((entry) => entry.id === revoke.dataset.memberRevoke);
    try { await revokeMemberSessions(item); } catch (error) { window.adminConsole.setStatus($("memberSaveStatus"), error.message, "error"); }
  }
  const del = event.target.closest("[data-member-delete]");
  if (del) {
    const item = libraryState.data.members.find((entry) => entry.id === del.dataset.memberDelete);
    deleteResource("member", item.id, $("memberSaveStatus"), item.email);
  }
});
$("memberSearch").addEventListener("input", (event) => { libraryState.memberQuery = event.target.value; renderLibrary(); }); $("memberFilter").addEventListener("change", (event) => { libraryState.memberFilter = event.target.value; renderLibrary(); });

window.addEventListener("admin:connected", loadLibrary);
