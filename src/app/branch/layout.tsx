import { CurrentUserProvider } from "@/lib/useCurrentUser";
import { BranchShell } from "@/components/branch/BranchShell";

export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return <CurrentUserProvider role="BRANCH_MANAGER"><BranchShell>{children}</BranchShell></CurrentUserProvider>;
}
