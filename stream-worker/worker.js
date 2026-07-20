function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function authorized(request, env) {
  const header = request.headers.get("authorization") || "";
  return Boolean(env.ADMIN_TOKEN && header === `Bearer ${env.ADMIN_TOKEN}`);
}

export default {
  async fetch(request, env) {
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      const url = new URL(request.url);
      const input = await request.json();
      if (url.pathname === "/upload") {
        const name = String(input.name || "会员视频").trim().slice(0, 180);
        const maxDurationSeconds = Math.min(21600, Math.max(60, Number(input.maxDurationSeconds) || 3600));
        const upload = await env.STREAM.createDirectUpload({
          maxDurationSeconds,
          expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          creator: "ethan-admin",
          meta: { name, source: "member-course-admin" },
          allowedOrigins: ["ethanweb3.com", "www.ethanweb3.com"],
          requireSignedURLs: true,
        });
        return json({ ok: true, id: upload.id, uploadURL: upload.uploadURL });
      }

      if (url.pathname === "/token") {
        const videoId = String(input.videoId || "").trim();
        if (!/^[a-z0-9-]{3,160}$/i.test(videoId)) return json({ error: "Invalid video ID" }, 400);
        const token = await env.STREAM.video(videoId).generateToken();
        return json({ ok: true, token });
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Stream request failed" }, error.statusCode || 400);
    }
  },
};
