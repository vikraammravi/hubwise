/** Deployment-owned configuration. Never derived from a cookie or request header. */
export function platformDeployment() { return process.env.APP_SURFACE === "platform"; }
export function platformConsoleEnabled() { return platformDeployment() && process.env.PLATFORM_CONSOLE_ENABLED === "true"; }

export function operationsAppOrigin(): string | null {
  const configured = process.env.OPERATIONS_APP_ORIGIN?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol === "https:") return url.origin;

    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return process.env.NODE_ENV === "development" && url.protocol === "http:" && loopback ? url.origin : null;
  } catch {
    return null;
  }
}
