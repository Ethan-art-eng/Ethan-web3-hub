import {
  onRequestGet as handleGet,
  onRequestPost as handlePost,
  onRequestPut as handlePut,
} from "../../../api/cex-yields.js";

function adminContext(context) {
  const url = new URL(context.request.url);
  if (!["history", "monitor"].some((key) => url.searchParams.get(key) === "1")) {
    url.searchParams.set("admin", "1");
  }
  return { ...context, request: new Request(url, context.request) };
}

export function onRequestGet(context) {
  return handleGet(adminContext(context));
}

export function onRequestPost(context) {
  return handlePost(context);
}

export function onRequestPut(context) {
  return handlePut(context);
}
