import { onRequestGet as getProjects, onRequestPut as putProjects } from "../../../api/airdrop-projects.js";

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.searchParams.set("admin", "1");
  return getProjects({ ...context, request: new Request(url, context.request) });
}

export function onRequestPut(context) {
  return putProjects(context);
}
