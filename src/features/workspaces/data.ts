import { supabase } from "@/lib/supabase/client";
import { BUSINESS_HEADER, businessSelectionCookies, parseWorkspace, selectedBusiness, validBusinessId, WORKSPACE_CHANGED_EVENT } from "./context";
import { saveBusinessSelection } from "./selection";
import { setDisplayedBusiness } from "./fetch";
import type { ProfileStatus, UserRole } from "@/lib/supabase/types";

export type WorkspaceChoice = { business_id: string; name: string; slug: string; role: UserRole; status: ProfileStatus; business_status: string; isolation_ready: boolean };
export async function fetchWorkspaceChoices(signal: AbortSignal): Promise<WorkspaceChoice[]> {
  const { error, data } = await supabase.rpc("my_workspaces").abortSignal(signal);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Unable to load your workspaces.");
  return data as WorkspaceChoice[];
}
export async function chooseWorkspace(id: string, signal?: AbortSignal) {
  if (!validBusinessId(id)) throw new Error("Invalid workspace selection.");
  signal?.throwIfAborted();
  const previousSelection = businessSelectionCookies(document.cookie).join(";");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in first.");
  signal?.throwIfAborted();

  // Verify this scope without publishing the cookie to other requests or tabs.
  const request = supabase.rpc("current_workspace").setHeader(BUSINESS_HEADER, id);
  const result = await (signal ? request.abortSignal(signal) : request);
  signal?.throwIfAborted();
  if (result.error) throw new Error(result.error.message);
  const workspace = parseWorkspace(result.data, user.id);
  if (workspace.business.id !== id) throw new Error("Workspace selection could not be verified.");
  if (previousSelection !== businessSelectionCookies(document.cookie).join(";")) throw new Error("Workspace changed. Reload before continuing.");

  saveBusinessSelection(id);
  if (selectedBusiness(document.cookie) !== id) throw new Error("Workspace selection could not be saved.");
  setDisplayedBusiness(id);
  window.dispatchEvent(new Event(WORKSPACE_CHANGED_EVENT));
  return workspace;
}
