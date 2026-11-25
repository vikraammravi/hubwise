"use client";

import { BusinessLink } from "@/features/workspaces/BusinessLink";
import { useGreeting } from "@/lib/useGreeting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiGrid, type Kpi } from "@/components/shared/KpiCard";
import { Banner } from "@/components/shared/Banner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/features/orders/domain";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchDashboard } from "@/features/dashboard/admin-data";
import { formatMoney, POLL_INTERVAL, DEFAULT_STOCK_THRESHOLD } from "@/lib/format";
import { ClipboardList } from "lucide-react";
import { TileGrid, type HomeTile } from "@/components/shared/TileGrid";
import { navigationIcons as icons } from "@/lib/navigation-icons";
import { ATTENTION_POLL_INTERVAL, countBadge, fetchAdminAttention } from "@/features/dashboard/attention-data";

export default function AdminDashboardPage() {
  const greeting = useGreeting();
  const { data, loading, error } = useAsyncData(fetchDashboard, { pollInterval: POLL_INTERVAL });
  const orders = data?.recentOrders ?? [];
  const lowStock = data?.lowStock ?? 0;

  const kpis: Kpi[] = [
    { label: "Orders Today", value: `${data?.ordersToday ?? 0}` },
    { label: "Pending", value: `${data?.pendingOrders ?? 0}`, tone: "warn" },
    { label: "Revenue Today", value: formatMoney(data?.revenueToday), hint: "Completed orders · Toronto time", tone: "success" },
    { label: "Low / Out of Stock", value: `${lowStock}`, tone: lowStock ? "warn" : "default" },
  ];

  const lowItems = data?.lowItems ?? [];
  const attention = useAsyncData(fetchAdminAttention, { pollInterval: ATTENTION_POLL_INTERVAL });
  const counts = attention.data;
  const tiles: HomeTile[] = [
    { label: "Branch Orders", href: "/admin/orders", icon: icons.orders, description: "Review, prepare and confirm pickups",
      badge: countBadge(counts?.pickupRequests, counts?.pickupRequests === 1 ? "pickup request" : "pickup requests") ?? countBadge(counts?.openOrders, "open") },
    { label: "Daily Stock", href: "/admin/stock", icon: icons.stock, description: "Hub stock levels", badge: countBadge(lowStock, "low") },
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
      <PageHeader eyebrow={greeting} title="Home" subtitle="Start with what needs attention." />
      {error && <Banner tone="danger">{error}</Banner>}
      <TileGrid label="Admin areas" tiles={tiles} loading={loading || attention.loading} />
      <h2 className="pt-2 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Today</h2>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <KpiGrid items={kpis} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Low Stock</CardTitle>
            <BusinessLink href="/admin/stock" className="text-sm text-saffron-hover">
              Manage stock
            </BusinessLink>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowItems.length === 0 && !loading && <EmptyState title="Everything stocked" />}
            {lowItems.map((i) => (
              <div key={i.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-muted-foreground">{i.available_stock} left</span>
                </div>
                <Progress
                  value={Math.min(100, (i.available_stock / Math.max(1, i.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD)) * 100)}
                  className="mt-1.5 h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Branch Orders</CardTitle>
            <BusinessLink href="/admin/orders" className="text-sm text-saffron-hover">
              View all
            </BusinessLink>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {orders.length === 0 && !loading && <EmptyState title="No orders today" />}
            {orders.slice(0, 5).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium">{o.locations?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">#{o.order_number}</div>
                </div>
                <StatusBadge
                  status={ORDER_STATUS_BADGE[o.status]}
                  label={ORDER_STATUS_LABEL[o.status]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
