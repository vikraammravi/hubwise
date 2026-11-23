import "server-only";

import { randomUUID } from "node:crypto";
import { hasSameOrigin } from "@/lib/request-origin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validBusinessId } from "@/features/workspaces/context";
import { PlatformAccessError, platformSession } from "./access";

const headers = { "Cache-Control": "private, no-store" };
const BUCKET = "business-branding";
const MAX_LOGO_BYTES = 512 * 1024;
const LOGO_TYPES: Record<string, { ext: string; magic: (bytes: Uint8Array) => boolean }> = {
  "image/png": { ext: "png", magic: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/jpeg": { ext: "jpg", magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", magic: b => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
};

function failure(error: unknown) {
  const known = error instanceof PlatformAccessError;
  return Response.json({ error: known ? error.message : "Unable to update branding. Please try again." }, { status: known ? error.status : 503, headers });
}
async function guard(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
  const session = await platformSession();
  if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true") throw new PlatformAccessError("Business setup is not enabled yet.", 409);
  const { id } = await context.params;
  if (!validBusinessId(id)) throw new PlatformAccessError("Choose a valid business.", 400);
  return { session, id };
}
function text(value: unknown, max: number, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw new PlatformAccessError(`${label} is not valid.`, 400);
  return value.trim();
}

/** Sets a business's sign-in branding (display name, accent, logo). Empty values clear a field. */
export async function updateBusinessBranding(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { session, id } = await guard(request, context);
    const raw = await request.text();
    if (raw.length > 4096) throw new PlatformAccessError("Branding details are too large.", 413);
    let values: Record<string, unknown>;
    try { values = JSON.parse(raw); } catch { throw new PlatformAccessError("Invalid branding details.", 400); }
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new PlatformAccessError("Invalid branding details.", 400);
    const displayName = text(values.displayName, 200, "Display name");
    const accent = text(values.accent, 20, "Accent colour");
    const logoUrl = text(values.logoUrl, 500, "Logo");
    if (displayName.length > 80) throw new PlatformAccessError("Use a display name of 80 characters or fewer.", 400);
    if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) throw new PlatformAccessError("Choose a colour like #4F46E5.", 400);
    const result = await session.rpc("platform_update_business_branding", { p_business_id: id, p_display_name: displayName, p_accent: accent, p_logo_url: logoUrl });
    if (result.error) {
      if (result.error.code === "22023") throw new PlatformAccessError("Check the display name, colour and logo.", 400);
      if (result.error.code === "P0002") throw new PlatformAccessError("Business not found.", 404);
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      throw result.error;
    }
    return Response.json({ branding: result.data }, { headers });
  } catch (error) { return failure(error); }
}

/** Uploads a logo (PNG, JPEG or WebP, up to 512 KB) and returns its public URL; save it with updateBusinessBranding. */
export async function uploadBusinessLogo(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { session, id } = await guard(request, context);
    if (Number(request.headers.get("content-length")) > MAX_LOGO_BYTES + 16 * 1024) throw new PlatformAccessError("Use a logo of 512 KB or smaller.", 413);
    let form: FormData;
    try { form = await request.formData(); } catch { throw new PlatformAccessError("Choose a logo file.", 400); }
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new PlatformAccessError("Choose a logo file.", 400);
    if (file.size > MAX_LOGO_BYTES) throw new PlatformAccessError("Use a logo of 512 KB or smaller.", 413);
    const type = LOGO_TYPES[file.type];
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!type || !type.magic(bytes)) throw new PlatformAccessError("Use a PNG, JPEG or WebP image.", 415);
    const business = await session.from("businesses").select("id").eq("id", id).maybeSingle();
    if (business.error) throw business.error;
    if (!business.data) throw new PlatformAccessError("Business not found.", 404);
    let admin: ReturnType<typeof createSupabaseAdmin>;
    try { admin = createSupabaseAdmin(); } catch { throw new PlatformAccessError("Logo upload is not configured.", 503); }
    const path = `${id}/${randomUUID()}.${type.ext}`;
    const uploaded = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (uploaded.error) throw new PlatformAccessError("The logo could not be uploaded. Please try again.", 503);
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ logoUrl: data.publicUrl }, { status: 201, headers });
  } catch (error) { return failure(error); }
}
