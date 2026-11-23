"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { businessEntryPath } from "../business-address";
import { businessRoleDestination } from "../business-routes";
import { useAsyncData } from "@/lib/useAsyncData";
import { chooseWorkspace, fetchWorkspaceChoices } from "../data";

export default function BusinessEntry({ slug, next = null }: { slug: string; next?: string | null }) {
  const router = useRouter();
  const openBusiness = useCallback(async (signal: AbortSignal) => {
    const choices = await fetchWorkspaceChoices(signal);
    const business = choices.find(choice => choice.slug === slug && choice.status === "active" && choice.business_status === "active" && choice.isolation_ready);
    if (!business) return false;

    const selected = await chooseWorkspace(business.business_id, signal);
    signal.throwIfAborted();
    router.replace(businessRoleDestination(slug, next, selected.profile.role));
    router.refresh();
    return true;
  }, [next, router, slug]);
  const entry = useAsyncData(openBusiness, { refreshOnFocus: false });

  return <main className="mx-auto min-h-screen w-full max-w-lg space-y-5 px-4 py-10 sm:px-6">
    {entry.loading || entry.data ? <LoadingState label="Opening business…" /> : <>
      <h1 className="text-2xl font-semibold">Business access</h1>
      {entry.error ? <Banner tone="danger">{entry.error}</Banner> : <p className="text-sm text-muted-foreground">This business is unavailable for your account. Contact your administrator.</p>}
      <div className="flex flex-wrap gap-2">
        {entry.error && <Button onClick={() => void entry.refresh()}>Try again</Button>}
        <Button asChild variant="outline"><Link href="/workspaces">My workspaces</Link></Button>
        <SignOutButton variant="compact" returnTo={businessEntryPath(slug) ?? undefined} />
      </div>
    </>}
  </main>;
}
