/** Deployment-owned configuration. Never derived from a cookie or request header. */
export function platformDeployment() { return process.env.APP_SURFACE === "platform"; }
export function platformConsoleEnabled() { return platformDeployment() && process.env.PLATFORM_CONSOLE_ENABLED === "true"; }

/**
 * The business a bare visit ("/" or "/login") opens. With BUSINESS_DEFAULT_HOSTS set, only those
 * hostnames get it (e.g. Ahaa's own domain), so the shared Hubwise address never lands on Ahaa.
 */
export function businessDefaultSlug(hostname: string): string {
  const slug = process.env.BUSINESS_DEFAULT_SLUG?.trim() ?? "";
  const hosts = (process.env.BUSINESS_DEFAULT_HOSTS ?? "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  return slug && (hosts.length === 0 || hosts.includes(hostname.toLowerCase())) ? slug : "";
}

/**
 * The default business's own domain (the first BUSINESS_DEFAULT_HOSTS entry) when the request
 * arrives on another host, e.g. the shared Hubwise address. Its pages forward there.
 */
export function businessDefaultHome(hostname: string): { slug: string; origin: string } | null {
  const slug = process.env.BUSINESS_DEFAULT_SLUG?.trim() ?? "";
  const hosts = (process.env.BUSINESS_DEFAULT_HOSTS ?? "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!slug || hosts.length === 0 || hosts.includes(hostname.toLowerCase())) return null;
  return /^[a-z0-9.-]+$/.test(hosts[0]) ? { slug, origin: `https://${hosts[0]}` } : null;
}

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
