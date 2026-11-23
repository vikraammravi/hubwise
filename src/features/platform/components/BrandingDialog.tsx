"use client";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { BusinessMark } from "@/components/shared/BusinessMark";
import { cn } from "@/lib/utils";
import { updateBusinessBranding, uploadBusinessLogo, type PlatformBusiness } from "../data";

const SWATCHES = ["#4f46e5", "#0ea5e9", "#059669", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#334155"];
const HEX = /^#[0-9a-fA-F]{6}$/;

function BrandingForm({ business, onClose, onSaved }: { business: PlatformBusiness; onClose: () => void; onSaved: () => void }) {
  const current = business.branding;
  const [displayName, setDisplayName] = useState(current?.display_name ?? "");
  const [accent, setAccent] = useState(current?.accent ?? "");
  const [logoUrl, setLogoUrl] = useState(current?.logo_url ?? "");
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const previewName = displayName.trim() || business.name;
  const validAccent = HEX.test(accent) ? accent.toLowerCase() : null;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 512 * 1024) { setError("Use a logo of 512 KB or smaller."); return; }
    setBusy("upload"); setError("");
    try { setLogoUrl(await uploadBusinessLogo(business.id, file)); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to upload the logo."); }
    finally { setBusy(null); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (accent && !validAccent) { setError("Choose a colour like #4F46E5."); return; }
    setBusy("save"); setError("");
    try { await updateBusinessBranding(business.id, { displayName: displayName.trim(), accent: validAccent ?? "", logoUrl }); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save branding."); setBusy(null); }
  }

  return <form onSubmit={save} className="space-y-5">
    {error && <Banner tone="danger">{error}</Banner>}
    <div className="rounded-xl border bg-muted/40 p-5">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign-in preview</p>
      <BusinessMark name={previewName} logoUrl={logoUrl || null} accent={validAccent} size="lg" />
      <div className="mt-4 flex justify-center">
        <span className="rounded-md px-4 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: validAccent ?? "#4f46e5" }}>Sign In</span>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="branding-name">Display name</Label>
      <Input id="branding-name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} placeholder={business.name} disabled={busy !== null} />
      <p className="text-xs text-muted-foreground">Shown on the business&apos;s sign-in page. Leave empty to use “{business.name}”.</p>
    </div>

    <fieldset className="space-y-2" disabled={busy !== null}>
      <legend className="text-sm font-medium">Brand colour</legend>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map(swatch => <button key={swatch} type="button" aria-label={`Use colour ${swatch}`} aria-pressed={validAccent === swatch} onClick={() => setAccent(swatch)}
          className={cn("size-7 rounded-full ring-offset-2 ring-offset-background transition", validAccent === swatch ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border")} style={{ backgroundColor: swatch }} />)}
        <Input aria-label="Custom colour" value={accent} onChange={event => setAccent(event.target.value.trim())} placeholder="#4F46E5" maxLength={7} className="h-8 w-28 font-mono text-xs" />
        {accent && <Button type="button" variant="ghost" size="sm" onClick={() => setAccent("")}>Default</Button>}
      </div>
    </fieldset>

    <div className="space-y-2">
      <span className="text-sm font-medium">Logo</span>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload logo" onChange={event => void upload(event)} />
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => fileInput.current?.click()}><ImageUp className="size-4" />{busy === "upload" ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}</Button>
        {logoUrl && <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => setLogoUrl("")}><Trash2 className="size-4" />Remove</Button>}
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 512 KB. A wide logo on a transparent background looks best.</p>
    </div>

    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy !== null} onClick={onClose}>Cancel</Button>
      <Button type="submit" disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save branding"}</Button>
    </div>
  </form>;
}

/** Edits the sign-in branding a business's people see at /b/<slug>. */
export function BrandingDialog({ business, onClose, onSaved }: { business: PlatformBusiness | null; onClose: () => void; onSaved: () => void }) {
  return <Dialog open={business !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Branding</DialogTitle>
        <DialogDescription>How {business?.name} appears on its sign-in page. Other businesses never see it.</DialogDescription>
      </DialogHeader>
      {business && <BrandingForm key={business.id} business={business} onClose={onClose} onSaved={onSaved} />}
    </DialogContent>
  </Dialog>;
}
