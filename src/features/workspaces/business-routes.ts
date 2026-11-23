import { userHome } from "@/lib/auth";
import type { UserRole } from "@/lib/supabase/types";
import { businessEntryPath, businessSlugFromAddress } from "./business-address";

const localOrigin = "https://app.invalid";
const employeePages = new Set(["/branch/inventory", "/branch/catering", "/branch/profile"]);

function localUrl(path: string | null): URL | null {
  if (!path?.startsWith("/") || path.startsWith("//") || /[\\\p{Cc}]/u.test(path)) return null;
  const url = new URL(path, localOrigin);
  return url.origin === localOrigin ? url : null;
}

export function parseBusinessRolePath(path: string): { slug: string; rolePath: string } | null {
  const match = path.match(/^\/([^/]+)(\/(?:admin|branch)(?:\/[^/?#]+)*)\/?$/);
  if (!match) return null;
  const [, address, rolePath] = match;
  const slug = businessSlugFromAddress(address);
  return slug && !unsafeRolePath(rolePath) ? { slug, rolePath } : null;
}

function unsafeRolePath(pathname: string): boolean {
  return /[\\\p{Cc}]|%2f|%5c|%00/iu.test(pathname) || pathname.split("/").some(part => part === "." || part === "..");
}

export function businessRolePath(slug: string, path: string): string {
  const entry = businessEntryPath(slug);
  const url = localUrl(path);
  if (!entry || !url || unsafeRolePath(url.pathname) || !/^\/(?:admin|branch|employee)(?:\/|$)/.test(url.pathname)) return path;
  const pathname = url.pathname.replace(/^\/employee(?=\/|$)/, "/branch");
  return `${entry}${pathname}${url.search}${url.hash}`;
}

/** Convert an external page to its existing role-specific implementation. */
export function businessRolePage(rolePath: string, role: UserRole): string | null {
  if (role === "CENTRAL_ADMIN") return rolePath.startsWith("/admin/") ? rolePath : null;
  if (role === "BRANCH_MANAGER") return rolePath.startsWith("/branch/") ? rolePath : null;
  return employeePages.has(rolePath) ? rolePath.replace(/^\/branch/, "/employee") : null;
}

/** Keep only a continuation belonging to this business and the verified role. */
export function businessRoleDestination(slug: string, next: string | null, role: UserRole): string {
  const url = localUrl(next);
  const parsed = url && parseBusinessRolePath(url.pathname);
  if (parsed && parsed.slug === slug && businessRolePage(parsed.rolePath, role)) {
    return businessRolePath(slug, parsed.rolePath + url.search + url.hash);
  }
  return businessRolePath(slug, userHome(role));
}
