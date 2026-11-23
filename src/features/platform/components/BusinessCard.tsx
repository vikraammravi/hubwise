"use client";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { businessEntryPath } from "@/features/workspaces/business-address";
import { invitationStatus, type BusinessLifecycleAction, type InvitationStatus, type PlatformBusiness } from "../data";

export type BusinessActions = {
  inviteEnabled: boolean;
  assignEnabled: boolean;
  activationEnabled: boolean;
  /** When invitation status could not be loaded, a live link may exist: block new admin setup. */
  invitationStatusUnknown: boolean;
  businessAppOrigin: string | null;
  onSetUpAdmin: (business: PlatformBusiness) => void;
  onReissue: (business: PlatformBusiness) => void;
  onRevoke: (business: PlatformBusiness) => void;
  onActivate: (business: PlatformBusiness) => void;
  onResolve: (business: PlatformBusiness) => void;
  /** Present when branding may be edited (business setup enabled). */
  onBranding?: (business: PlatformBusiness) => void;
  onLifecycle?: (business: PlatformBusiness, action: BusinessLifecycleAction) => void;
};

const BUSINESS_STATUS: Record<PlatformBusiness["status"], { label: string; className: string; dot: string }> = {
  provisioning: { label: "In setup", className: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  suspended: { label: "Suspended", className: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
};

export function StatusPill({ status }: { status: PlatformBusiness["status"] }) {
  const style = BUSINESS_STATUS[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style.className)}>
    <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />{style.label}
  </span>;
}

function adminStep(business: PlatformBusiness, invite: InvitationStatus): { done: boolean; text: string; tone?: "warn" | "danger" } {
  if (business.owner_assigned) return { done: true, text: invite === "accepted" ? "Admin accepted invitation" : "Admin assigned" };
  const invitation = business.invitation;
  switch (invite) {
    case "pending": return { done: false, text: `Invited ${invitation!.email} · expires ${formatDateTime(invitation!.expires_at)}` };
    case "expired": return { done: false, text: `Invitation to ${invitation!.email} expired`, tone: "warn" };
    case "review": return { done: false, text: `Setup by ${invitation!.email} was interrupted. Resolve it to continue.`, tone: "danger" };
    case "revoked": return { done: false, text: "Invitation revoked" };
    default: return { done: false, text: "No admin yet" };
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || "?";
}

/** One business in the platform directory: identity, status, onboarding progress and the next action. */
export function BusinessCard({ business, actions }: { business: PlatformBusiness; actions: BusinessActions }) {
  const entryPath = businessEntryPath(business.slug);
  const invite = invitationStatus(business.invitation);
  const inSetup = business.status === "provisioning" && !business.isolation_ready;
  const statusUnknown = actions.invitationStatusUnknown && inSetup && !business.owner_assigned;
  const admin = statusUnknown ? { done: false, text: "Invitation status unavailable", tone: "warn" as const } : adminStep(business, invite);
  const canSetUpAdmin = inSetup && !business.owner_assigned && !statusUnknown && invite !== "pending" && invite !== "review" && (actions.inviteEnabled || actions.assignEnabled);
  const canManageInvite = inSetup && !business.owner_assigned && invite === "pending" && actions.inviteEnabled;
  const canResolve = inSetup && !business.owner_assigned && !statusUnknown && invite === "review" && actions.inviteEnabled;
  const canActivate = inSetup && business.owner_assigned && actions.activationEnabled;
  const lifecycleAction = actions.onLifecycle && !["ahaa", "aaha"].includes(business.slug)
    ? businessLifecycleAction(business, statusUnknown)
    : null;
  const steps = [
    { label: "Registered", done: true },
    { label: "Admin ready", done: admin.done },
    { label: "Activated", done: business.status === "active" },
  ];

  return <li className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:items-center sm:px-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.75fr)] xl:gap-5">
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground ring-1 ring-inset ring-border">{initials(business.name)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{business.name}</h3>
          <StatusPill status={business.status} />
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">{entryPath}</p>
      </div>
    </div>

    <div className="min-w-0 space-y-1.5">
      {business.status === "provisioning"
        ? <>
            <ol aria-label={`Setup progress for ${business.name}`} className="flex flex-wrap items-center gap-1.5">
              {steps.map((step, index) => <li key={step.label} className="flex items-center gap-1.5">
                <span className={cn("grid size-4 place-items-center rounded-full ring-1 ring-inset", step.done ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-transparent ring-border")}>
                  <Check aria-hidden className="size-2.5" />
                </span>
                <span className={cn("whitespace-nowrap text-xs", step.done ? "text-foreground" : "text-muted-foreground")}><span className="sr-only">{step.done ? "Done: " : "To do: "}</span>{step.label}</span>
                {index < steps.length - 1 && <span aria-hidden className={cn("h-px w-4", step.done ? "bg-primary" : "bg-border")} />}
              </li>)}
            </ol>
            <p className={cn("truncate text-xs", admin.tone === "danger" ? "text-red-700" : admin.tone === "warn" ? "text-amber-700" : "text-muted-foreground")} title={admin.text}>{admin.text}</p>
          </>
        : <p className="text-xs text-muted-foreground">{business.status === "suspended" ? "Access suspended" : business.isolation_ready ? "Available to members" : "Existing access"}</p>}
    </div>

    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-1 [&_[data-slot=button]]:min-h-11 sm:[&_[data-slot=button]]:min-h-9">
      {canResolve && <Button size="lg" onClick={() => actions.onResolve(business)}>Resolve interrupted setup</Button>}
      {canActivate && <Button size="lg" onClick={() => actions.onActivate(business)}>Activate business</Button>}
      {canSetUpAdmin && <Button size="lg" onClick={() => actions.onSetUpAdmin(business)}>{actions.inviteEnabled ? "Invite first admin" : "Assign first admin"}</Button>}
      {canManageInvite && <Button size="lg" onClick={() => actions.onReissue(business)}>Reissue link</Button>}
      {business.status === "active" && business.isolation_ready && actions.businessAppOrigin && entryPath && <Button asChild size="lg">
        <a href={`${actions.businessAppOrigin}${entryPath}`}>Open business sign-in</a>
      </Button>}
      {lifecycleAction === "restore" && <Button size="lg" onClick={() => actions.onLifecycle?.(business, lifecycleAction)}>Restore access</Button>}
      {actions.onBranding && <Button size="lg" variant="outline" onClick={() => actions.onBranding?.(business)}>Branding</Button>}
      {canManageInvite && <Button size="lg" variant="destructive" onClick={() => actions.onRevoke(business)}>Revoke</Button>}
      {(lifecycleAction === "delete" || lifecycleAction === "suspend") && <Button size="lg" variant="destructive" onClick={() => actions.onLifecycle?.(business, lifecycleAction)}>
        {lifecycleAction === "delete" ? "Delete business" : "Suspend business"}
      </Button>}
    </div>
  </li>;
}

function businessLifecycleAction(business: PlatformBusiness, statusUnknown: boolean): BusinessLifecycleAction | null {
  if (business.isolation_ready) {
    if (business.status === "active") return "suspend";
    if (business.status === "suspended") return "restore";
    return null;
  }
  if (business.status === "provisioning" && !business.owner_assigned && !business.invitation && !statusUnknown
    && !Object.values(business.branding ?? {}).some(Boolean)) return "delete";
  return null;
}
