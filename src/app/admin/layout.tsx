import { CurrentUserProvider } from "@/lib/useCurrentUser";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <CurrentUserProvider role="CENTRAL_ADMIN"><AdminShell>{children}</AdminShell></CurrentUserProvider>;
}
