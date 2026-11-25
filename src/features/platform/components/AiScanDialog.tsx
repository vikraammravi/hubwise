"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { updateBusinessAiScan } from "../data";
import { AI_SCAN_MAX_MONTHLY, type AiScanUsage } from "../usage-model";

export type AiScanTarget = { businessId: string; name: string; scan: AiScanUsage };

function AiScanForm({ target, onClose, onSaved }: { target: AiScanTarget; onClose: () => void; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(target.scan.enabled);
  const [limit, setLimit] = useState(String(target.scan.monthlyLimit));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const monthlyLimit = Number(limit);
    if (!/^\d+$/.test(limit.trim()) || monthlyLimit > AI_SCAN_MAX_MONTHLY) { setError(`Enter a whole number from 0 to ${AI_SCAN_MAX_MONTHLY}.`); return; }
    setBusy(true); setError("");
    try { await updateBusinessAiScan(target.businessId, { enabled, monthlyLimit }); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to update AI scanning."); setBusy(false); }
  }

  return <form onSubmit={save} className="space-y-5">
    {error && <Banner tone="danger">{error}</Banner>}
    <label className="flex items-start gap-3 rounded-lg border p-3">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={busy} />
      <span>
        <span className="block text-sm font-medium">AI scanning on</span>
        <span className="block text-xs text-muted-foreground">When off, staff can still upload receipts and enter details by hand.</span>
      </span>
    </label>
    <div className="space-y-2">
      <Label htmlFor="ai-scan-limit">Monthly allowance</Label>
      <Input id="ai-scan-limit" inputMode="numeric" value={limit} onChange={event => setLimit(event.target.value)} disabled={busy} aria-describedby="ai-scan-limit-help" className="w-32" />
      <p id="ai-scan-limit-help" className="text-xs text-muted-foreground">
        Scans this business can run each calendar month (UTC). Used so far: {target.scan.thisMonth}. All businesses together share a platform ceiling of 100 scans a month (Azure free tier), so an allowance above 100 has no extra effect for now. Each person can run 10 a day. On with 100 is the default.
      </p>
    </div>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </div>
  </form>;
}

/** Superadmin control for one business's AI scanning. */
export function AiScanDialog({ target, onClose, onSaved }: { target: AiScanTarget | null; onClose: () => void; onSaved: () => void }) {
  return <Dialog open={target !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>AI scanning</DialogTitle>
        <DialogDescription>Receipt and invoice scanning for {target?.name}.</DialogDescription>
      </DialogHeader>
      {target && <AiScanForm key={target.businessId} target={target} onClose={onClose} onSaved={onSaved} />}
    </DialogContent>
  </Dialog>;
}
