export async function onRequestGet({ params, env }) {
  if (!env.CONTENT_DB || !/^image-[a-f0-9-]{36}$/i.test(String(params.id || ""))) return new Response("Not found", { status: 404 });
  const asset = await env.CONTENT_DB.prepare("SELECT content_type, data FROM media_assets WHERE id = ? LIMIT 1").bind(params.id).first();
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.data, { headers: { "content-type": asset.content_type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
