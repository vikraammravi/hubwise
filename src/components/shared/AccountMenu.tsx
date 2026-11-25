"use client";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BusinessLink } from "@/features/workspaces/BusinessLink";
import { useSignOut } from "./SignOutButton";

/** Header account menu: who is signed in, their profile, and sign out. The only place sign-out lives. */
export function AccountMenu({ user, profileHref, returnTo }: {
  user: { name: string; role: string; initials: string }; profileHref?: string; returnTo?: string;
}) {
  const signOut = useSignOut(returnTo);
  return <DropdownMenu>
    <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Account menu for ${user.name}`}>
      <Avatar className="size-9">
        <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{user.initials}</AvatarFallback>
      </Avatar>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="w-60">
      <DropdownMenuLabel className="px-2 py-1.5">
        <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
        <span className="block truncate text-xs font-normal text-muted-foreground">{user.role}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {profileHref && <DropdownMenuItem asChild>
        <BusinessLink href={profileHref} className="cursor-pointer"><UserRound className="size-4" />My Profile</BusinessLink>
      </DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => void signOut()} className="cursor-pointer text-[#DC2626] focus:text-[#DC2626]">
        <LogOut className="size-4" />Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
