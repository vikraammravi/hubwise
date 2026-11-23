"use client";

import { useCallback, type ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { businessRolePath, parseBusinessRolePath } from "./business-routes";

export function useBusinessHref() {
  const pathname = usePathname();
  const slug = pathname ? parseBusinessRolePath(pathname)?.slug : undefined;
  return useCallback((href: string) => slug ? businessRolePath(slug, href) : href, [slug]);
}

type BusinessLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function BusinessLink({ href, ...props }: BusinessLinkProps) {
  const businessHref = useBusinessHref();
  return <Link {...props} href={businessHref(href)} />;
}
