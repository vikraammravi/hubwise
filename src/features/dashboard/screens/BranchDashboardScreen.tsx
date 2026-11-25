"use client";

import { useCallback } from "react";
import { useGreeting } from "@/lib/useGreeting";
import { Banner } from "@/components/shared/Banner";
import { TileGrid, type HomeTile } from "@/components/shared/TileGrid";
import { fetchBranchDashboard } from "@/features/dashboard/branch-data";
import { ATTENTION_POLL_INTERVAL, countBadge, fetchBranchAttention } from "@/features/dashboard/attention-data";
import { useAsyncData } from "@/lib/useAsyncData";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import { useHeaderTitle } from "@/components/shared/ShellHeading";

/** Branch Home: a tile for every area, each showing what needs attention. */
export default function BranchHomePage() {
  const greeting = useGreeting();
  const { profile, loading: userLoading, error: userError } = useCurrentUser();
  const summary = useAsyncData(fetchBranchDashboard, { enabled: !userLoading && !!profile?.location_id });
  const data = summary.data?.branch?.id === profile?.location_id ? summary.data : null;
  const todaysOrder = data?.todaysOrder;
  const pending = data?.pendingOrders ?? 0;
  useHeaderTitle(data?.branch?.name);

  const locationId = profile?.location_id ?? null;
  const loadAttention = useCallback((signal: AbortSignal) => fetchBranchAttention(locationId!, signal), [locationId]);
  const attention = useAsyncData(loadAttention, { enabled: !userLoading && !!locationId, pollInterval: ATTENTION_POLL_INTERVAL });
  const unpaid = attention.data?.unpaidInvoices ?? 0;
  const tiles: HomeTile[] = [
    { label: "Place Order", href: "/branch/order", icon: icons.placeOrder, description: "Order from the hub",
      badge: data ? (todaysOrder ? { text: "Placed today", tone: "done" } : { text: "Not placed", tone: "attention" }) : null },
    { label: "Orders", href: unpaid ? "/branch/invoices?tab=invoices" : "/branch/invoices", icon: icons.orders, description: "Track orders and invoices",
      badge: countBadge(unpaid, "unpaid") ?? countBadge(pending, "in progress", "info") },
    { label: "Inventory", href: "/branch/inventory", icon: icons.stock, description: "Count stock and see what's on hand" },
    { label: "Catering", href: "/branch/catering", icon: icons.catering, description: "Bookings and preparation",
      badge: countBadge(data?.upcomingCateringCount, "upcoming", "info") },
    { label: "Vendor Invoices", href: "/branch/receipts", icon: icons.vendorInvoices, description: "Supplier bills and scans",
      badge: countBadge(attention.data?.receiptsToReview, "to review") },
  ];

  const pageError = summary.error ?? userError;
  const showLoading = userLoading || summary.loading;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 lg:space-y-6">
      <h1 className="text-forest text-xl font-semibold heading-tight sm:text-2xl">
        {greeting}{profile?.full_name ? `, ${profile.full_name.trim().split(/\s+/)[0]}` : ""}
      </h1>
      {pageError && <Banner tone="danger">{pageError}</Banner>}
      <TileGrid label="Branch areas" tiles={tiles} loading={showLoading} />
    </div>
  );
}
