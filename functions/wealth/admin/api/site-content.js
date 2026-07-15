import { onRequestGet as getContent, onRequestPut as putContent } from "../../../api/site-content.js";

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.searchParams.set("admin", "1");
  return getContent({ ...context, request: new Request(url, context.request) });
}

export function onRequestPut(context) {
  return putContent(context);
}
