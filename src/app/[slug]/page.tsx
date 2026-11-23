import { notFound, redirect } from "next/navigation";
import { platformDeployment } from "@/lib/app-surface";
import { businessEntryPath, businessSlugFromAddress } from "@/features/workspaces/business-address";
import { BusinessEntryPage } from "@/app/BusinessEntryPage";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";

export const metadata = { title: "Business workspace", description: "Business workspace sign-in" };

export default async function TenantPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { slug: address } = await params;
  const slug = businessSlugFromAddress(address);
  if (platformDeployment() || !businessWorkspacesEnabled() || !slug) notFound();
  const path = businessEntryPath(slug);
  const { next } = await searchParams;
  const destination = typeof next === "string" ? next : null;
  if (path && path !== `/${address}`) {
    redirect(destination ? `${path}?next=${encodeURIComponent(destination)}` : path);
  }
  return <BusinessEntryPage slug={slug} next={destination} />;
}
