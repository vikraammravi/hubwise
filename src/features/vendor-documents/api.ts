import { businessApiHeaders } from "@/features/workspaces/fetch";

export async function receiptApi(url: string, options?: RequestInit) {
  const headers = businessApiHeaders(options?.headers);
  const response = await fetch(url, { ...options, ...(headers ? { headers } : {}), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to complete receipt request.");
  return result;
}
