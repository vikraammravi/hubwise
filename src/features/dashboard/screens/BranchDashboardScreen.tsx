"use client";

import { BusinessLink } from "@/features/workspaces/BusinessLink";
import { BranchInventorySummary } from "@/features/inventory/components/BranchInventorySummary";
import { formatDate, formatTime } from "@/lib/format";
import { useGreeting } from "@/lib/useGreeting";
import { CalendarDays, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiGrid, type Kpi } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { fetchBranchDashboard } from "@/features/dashboard/branch-data";
import { useAsyncData } from "@/lib/useAsyncData";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/features/orders/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { TileGrid, type HomeTile } from "@/components/shared/TileGrid";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import { ATTENTION_POLL_INTERVAL, countBadge, fetchBranchAttention } from "@/features/dashboard/attention-data";
import { useCallback } from "react";

export default function BranchHomePage() {
  const greeting = useGreeting();
  const { profile, loading: userLoading, error: userError } = useCurrentUser();
  const summary = useAsyncData(fetchBranchDashboard, { enabled: !userLoading && !!profile?.location_id });
  const data = summary.data?.branch?.id === profile?.location_id ? summary.data : null;
  const branch = data?.branch;
  const orders = data?.recentOrders ?? [];
  const upcomingCatering = data?.upcomingCatering ?? [];
  const todaysOrder = data?.todaysOrder;
  const pending = data?.pendingOrders ?? 0;

  const kpis: Kpi[] = [
    {
      label: "Today's Order",
      value: todaysOrder
        ? `CA$${Number(todaysOrder.final_total_amount).toFixed(2)}`
        : "—",
      hint: todaysOrder ? "Submitted" : "Not placed yet",
      tone: todaysOrder ? "success" : "default",
    },
    { label: "In Progress", value: `${pending}`, hint: "Orders" },
    {
      label: "Upcoming Catering",
      value: `${summary.data?.upcomingCateringCount ?? 0}`,
      hint: "Events booked",
      tone: upcomingCatering.length ? "success" : "default",
    },
  ];

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
    { label: "My Profile", href: "/branch/profile", icon: icons.profile, description: "Your details and password" },
  ];

  const pageError = summary.error ?? userError;
  const showLoading = userLoading || summary.loading;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow={`${greeting}${profile?.full_name ? `, ${profile.full_name}` : ""}`}
        title={branch?.name ?? "Your Branch"}
        subtitle="Orders, stock and catering — all in one place."
      />

      {pageError && <Banner tone="danger">{pageError}</Banner>}
      <TileGrid label="Branch areas" tiles={tiles} loading={showLoading} />
      <BranchInventorySummary/>
      <h2 className="pt-2 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Today</h2>

      {showLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <KpiGrid items={kpis} className="lg:grid-cols-3" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <BusinessLink
              href="/branch/invoices"
              className="text-sm text-saffron-hover"
            >
              View all
            </BusinessLink>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {orders.length === 0 && !showLoading && (
              <EmptyState
                title="No orders yet"
                body="Start your first daily restock."
              />
            )}
            {orders.slice(0, 5).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium">#{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(o.created_at)} · CA$
                    {Number(o.final_total_amount).toFixed(2)}
                  </div>
                </div>
                <StatusBadge
                  status={ORDER_STATUS_BADGE[o.status]}
                  label={ORDER_STATUS_LABEL[o.status]}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Upcoming Catering</CardTitle>
            <BusinessLink
              href="/branch/catering"
              className="text-sm text-saffron-hover"
            >
              View all
            </BusinessLink>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {upcomingCatering.length === 0 && !showLoading && (
              <EmptyState
                title="No events booked"
                body="Log a catering booking to start tracking prep and payments."
                icon={<CalendarDays className="size-5" />}
              />
            )}
            {upcomingCatering.slice(0, 5).map((e) => {
              const dt = new Date(e.event_datetime);
              return (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {e.customer_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(dt)}{" "}
                        ·{" "}
                        {formatTime(dt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {e.guest_count}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">
                      CA${Number(e.total_amount).toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
