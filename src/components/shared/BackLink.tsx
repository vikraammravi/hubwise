import { BusinessLink } from "@/features/workspaces/BusinessLink";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
export function BackLink({href,children}:{href:string;children:React.ReactNode}){return <Button asChild variant="outline" size="sm"><BusinessLink href={href}><ChevronLeft className="size-4"/>{children}</BusinessLink></Button>;}
