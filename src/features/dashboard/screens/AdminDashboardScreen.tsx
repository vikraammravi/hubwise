"use client";

import { ClipboardList } from "lucide-react";
import { useGreeting } from "@/lib/useGreeting";
import { Banner } from "@/components/shared/Banner";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { TileGrid, type HomeTile } from "@/components/shared/TileGrid";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchDashboard } from "@/features/dashboard/admin-data";
import { ATTENTION_POLL_INTERVAL, countBadge, fetchAdminAttention } from "@/features/dashboard/attention-data";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import { POLL_INTERVAL } from "@/lib/format";

/** Admin Home: a tile for every area, each showing what needs attention. */
export default function AdminHomeScreen() {
  const greeting = useGreeting();
  const { profile } = useCurrentUser();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const { data, loading, error } = useAsyncData(fetchDashboard, { pollInterval: POLL_INTERVAL });
  const attention = useAsyncData(fetchAdminAttention, { pollInterval: ATTENTION_POLL_INTERVAL });
  const counts = attention.data;
  const tiles: HomeTile[] = [
    { label: "Branch Orders", href: "/admin/orders", icon: icons.orders, description: "Review, prepare and confirm pickups",
      badge: countBadge(counts?.pickupRequests, counts?.pickupRequests === 1 ? "pickup request" : "pickup requests") ?? countBadge(counts?.openOrders, "open") },
    { label: "Daily Stock", href: "/admin/stock", icon: icons.stock, description: "Hub stock levels", badge: countBadge(data?.lowStock, "low") },
    { label: "Branch Invoices", href: "/admin/invoices", icon: icons.invoices, description: "Combine orders and send invoices", badge: countBadge(counts?.invoicesToSend, "to send") },
    { label: "Catering", href: "/admin/catering", icon: icons.catering, description: "Events and preparation", badge: countBadge(counts?.cateringThisWeek, "this week", "info") },
    { label: "Vendor Invoices", href: "/admin/receipts", icon: icons.vendorInvoices, description: "Supplier bills and scans", badge: countBadge(counts?.receiptsToReview, "to review") },
    { label: "Branch Stock", href: "/admin/branch-stock", icon: ClipboardList, description: "Stock counts from branches" },
    { label: "Catalog", href: "/admin/catalog", icon: icons.catalog, description: "Items, prices and units" },
    { label: "Branch List", href: "/admin/branches", icon: icons.branches, description: "Locations and contact details" },
    { label: "User Access", href: "/admin/users", icon: icons.users, description: "People and their roles" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-forest text-xl font-semibold heading-tight sm:text-2xl">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
      {error && <Banner tone="danger">{error}</Banner>}
      <TileGrid label="Admin areas" tiles={tiles} loading={loading || attention.loading} columns="sm:grid-cols-3" />
    </div>
  );
}
