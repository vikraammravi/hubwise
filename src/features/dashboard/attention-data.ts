import { supabase } from "@/lib/supabase/client";
import { businessDateKey, businessDayStart } from "@/lib/date-range";

/** Attention counts change slowly; refresh them less often than the live order feed. */
export const ATTENTION_POLL_INTERVAL = 30000;

/**
 * Live "needs attention" counts for the home tiles. Each count is independent: one that fails to load
 * becomes null (its tile shows no status) instead of failing the home screen. Row-level security
 * limits every count to the signed-in business and, for branch users, their branch.
 */
type CountQuery = PromiseLike<{ count: number | null; error: unknown }>;
async function count(query: CountQuery): Promise<number | null> {
  try {
    const { count, error } = await query;
    return error ? null : count ?? 0;
  } catch { return null; }
}
const head = { count: "exact" as const, head: true };

export type AdminAttention = { openOrders: number | null; pickupRequests: number | null; cateringThisWeek: number | null; invoicesToSend: number | null; receiptsToReview: number | null };
export async function fetchAdminAttention(signal: AbortSignal): Promise<AdminAttention> {
  // Same window as the catering page: from the start of today's business day, for seven days.
  const today = businessDateKey(new Date());
  const weekEnd = businessDateKey(new Date(Date.parse(businessDayStart(today)) + 7 * 86400000));
  const [openOrders, pickupRequests, cateringThisWeek, invoicesToSend, receiptsToReview] = await Promise.all([
    // Same as the orders page's "Open" filter: every date, not just today.
    count(supabase.from("orders").select("id", head).in("status", ["SUBMITTED", "PREPARING", "READY"]).abortSignal(signal)),
    count(supabase.from("pickup_requests").select("id", head).or("status.eq.PENDING,return_status.eq.PENDING").abortSignal(signal)),
    count(supabase.from("catering_events").select("id", head).in("status", ["INQUIRY", "CONFIRMED"])
      .gte("event_datetime", businessDayStart(today)).lt("event_datetime", businessDayStart(weekEnd)).abortSignal(signal)),
    count(supabase.from("weekly_invoices").select("id", head).or("sent_at.is.null,needs_sending.eq.true").abortSignal(signal)),
    count(supabase.from("purchase_receipts").select("id", head).eq("status", "DRAFT").is("deleted_at", null).is("location_id", null).abortSignal(signal)),
  ]);
  return { openOrders, pickupRequests, cateringThisWeek, invoicesToSend, receiptsToReview };
}

export type BranchAttention = { unpaidInvoices: number | null; receiptsToReview: number | null };
export async function fetchBranchAttention(locationId: string, signal: AbortSignal): Promise<BranchAttention> {
  const [unpaidInvoices, receiptsToReview] = await Promise.all([
    count(supabase.from("weekly_invoices").select("id", head).eq("location_id", locationId).not("sent_at", "is", null).eq("payment_status", "UNPAID").abortSignal(signal)),
    count(supabase.from("purchase_receipts").select("id", head).eq("location_id", locationId).eq("status", "DRAFT").is("deleted_at", null).abortSignal(signal)),
  ]);
  return { unpaidInvoices, receiptsToReview };
}

/** "3 waiting" style status, or nothing when the count is zero or unknown. */
export function countBadge(value: number | null | undefined, text: string, tone: "attention" | "info" = "attention") {
  return value ? { text: `${value} ${text}`, tone } : null;
}
