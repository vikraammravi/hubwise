import { CurrentUserProvider } from "@/lib/useCurrentUser";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
export default function Layout({children}:{children:React.ReactNode}){return <CurrentUserProvider role="BRANCH_EMPLOYEE"><EmployeeShell>{children}</EmployeeShell></CurrentUserProvider>;}
