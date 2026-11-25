import "server-only";
import { hasSameOrigin } from "@/lib/request-origin";
import { validBusinessId } from "@/features/workspaces/context";
import { AI_SCAN_MAX_MONTHLY, parseBusinessUsage } from "@/features/platform/usage-model";
import { PlatformAccessError, platformSession } from "./access";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown, fallback: string) {
  const known = error instanceof PlatformAccessError;
  return Response.json({ error: known ? error.message : fallback }, { status: known ? error.status : 503, headers });
}

/** Usage per business (counts and dates only) for the console. */
export async function getBusinessUsage() {
  try {
    const session = await platformSession();
    const result = await session.rpc("platform_business_usage");
    if (result.error) {
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      throw new PlatformAccessError("Usage is not available yet. Apply the usage migration first.", 503);
    }
    return Response.json({ usage: parseBusinessUsage(result.data), generatedAt: new Date().toISOString() }, { headers });
  } catch (error) { return failure(error, "Unable to load usage. Please try again."); }
}

/** Turns AI scanning on or off for a business and sets its monthly allowance. */
export async function updateBusinessAiScan(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    const { id } = await context.params;
    if (!validBusinessId(id)) throw new PlatformAccessError("Choose a valid business.", 400);
    const raw = await request.text();
    if (raw.length > 1024) throw new PlatformAccessError("Scan settings are too large.", 413);
    let values: unknown;
    try { values = JSON.parse(raw); } catch { throw new PlatformAccessError("Invalid scan settings.", 400); }
    const { enabled, monthlyLimit } = (values && typeof values === "object" && !Array.isArray(values) ? values : {}) as Record<string, unknown>;
    if (typeof enabled !== "boolean") throw new PlatformAccessError("Choose whether AI scanning is on.", 400);
    if (typeof monthlyLimit !== "number" || !Number.isInteger(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > AI_SCAN_MAX_MONTHLY) {
      throw new PlatformAccessError(`Choose a monthly allowance between 0 and ${AI_SCAN_MAX_MONTHLY}.`, 400);
    }
    const result = await session.rpc("platform_set_business_ai_scan", { p_business_id: id, p_enabled: enabled, p_monthly_limit: monthlyLimit });
    if (result.error) {
      if (result.error.code === "22023") throw new PlatformAccessError(`Choose a monthly allowance between 0 and ${AI_SCAN_MAX_MONTHLY}.`, 400);
      if (result.error.code === "P0002") throw new PlatformAccessError("Business not found.", 404);
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      throw result.error;
    }
    return Response.json({ aiScan: result.data }, { headers });
  } catch (error) { return failure(error, "Unable to update AI scanning. Please try again."); }
}
