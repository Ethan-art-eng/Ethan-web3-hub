function decodeAccessPayload(jwt) {
  try {
    const encoded = jwt.split(".")[1];
    if (!encoded) return null;
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isAdminAuthorized(request, env) {
  const token = env.ADMIN_TOKEN;
  const authorization = request.headers.get("authorization");
  if (token && authorization === `Bearer ${token}`) return true;

  const url = new URL(request.url);
  const accessJwt = request.headers.get("cf-access-jwt-assertion");
  const accessPayload = accessJwt ? decodeAccessPayload(accessJwt) : null;
  const now = Math.floor(Date.now() / 1000);
  const accessEmail = request.headers.get("cf-access-authenticated-user-email") || accessPayload?.email || "";
  const expectedEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  const jwtIsCurrent = accessPayload
    && Number(accessPayload.exp) > now
    && (!accessPayload.nbf || Number(accessPayload.nbf) <= now);

  return Boolean(
    env.ACCESS_AUTH_ENABLED === "true"
      && url.hostname === "ethanweb3.com"
      && expectedEmail
      && accessJwt
      && jwtIsCurrent
      && accessEmail.trim().toLowerCase() === expectedEmail
  );
}
