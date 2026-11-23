// Top-level routes in src/app take precedence over customer workspace addresses.
// Keep this list in sync with the reserved-address database migration.
const reservedAddresses = new Set([
  "accept-invite", "activate-account", "admin", "api", "auth", "b", "branch",
  "employee", "forgot-password", "login", "set-password", "superadmin", "workspaces",
]);

// Ahaa keeps its existing registry slug and uses the brand spelling in public links.
const ahaaSlug = "ahaa";
const ahaaAddress = "aaha";

export function businessAddressIsReserved(slug: string): boolean {
  return reservedAddresses.has(slug) || slug === ahaaAddress;
}

export function hasBusinessSlugFormat(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function businessSlugFromAddress(address: string): string | null {
  if (address === ahaaAddress) return ahaaSlug;
  return hasBusinessSlugFormat(address) && !reservedAddresses.has(address) ? address : null;
}

export function businessEntryPath(slug: string): string | null {
  if (!hasBusinessSlugFormat(slug)) return null;
  if (slug === ahaaSlug) return `/${ahaaAddress}`;
  return businessAddressIsReserved(slug) ? null : `/${slug}`;
}
