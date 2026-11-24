import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { activeRole, safeNextPath, userHome } from "@/lib/auth";
import { BUSINESS_API_HEADER, BUSINESS_HEADER, businessEntrySlug, businessWorkspacesEnabled, selectedBusiness, validBusinessId } from "@/features/workspaces/context";
import { businessEntryPath } from "@/features/workspaces/business-address";
import { businessRoleDestination, businessRolePage, businessRolePath, parseBusinessRolePath } from "@/features/workspaces/business-routes";
import { loadSessionProfile } from "@/features/workspaces/session";
import { businessDefaultSlug, operationsAppOrigin, platformConsoleEnabled, platformDeployment } from "@/lib/app-surface";

const notFound = () => new NextResponse("Not found.", { status: 404 });

function isRoleDestination(path: string | null): boolean {
  return !!path && (safeNextPath(path, "CENTRAL_ADMIN") === path || safeNextPath(path, "BRANCH_MANAGER") === path || safeNextPath(path, "BRANCH_EMPLOYEE") === path);
}

function requestSelection(request: NextRequest): string | null {
  return selectedBusiness(request.headers.get("cookie") ?? "");
}

function businessApi(pathname: string): boolean {
  return pathname.startsWith("/api/admin/") || pathname.startsWith("/api/invoices/")
    || pathname === "/api/receipts" || pathname.startsWith("/api/receipts/");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  if (pathname === "/b" || pathname.startsWith("/b/")) return notFound();
  const platformOnly = platformDeployment();
  const consoleEnabled = platformConsoleEnabled();
  const isPlatformApi = pathname === "/api/platform" || pathname.startsWith("/api/platform/");
  const isLogin = pathname === "/login";
  const next = request.nextUrl.searchParams.get("next");
  const accountNotice = ["reset", "activated"].some(name => request.nextUrl.searchParams.get(name) === "1");
  if (platformOnly) {
    if (pathname === "/") return NextResponse.redirect(new URL("/superadmin", request.url));
    if (pathname === "/forgot-password" && next !== "/superadmin") {
      const url = request.nextUrl.clone();
      url.searchParams.set("next", "/superadmin");
      return NextResponse.redirect(url);
    }
    if (isLogin && next !== "/superadmin") {
      if (next !== null || !accountNotice) return notFound();
      const url = request.nextUrl.clone();
      url.searchParams.set("next", "/superadmin");
      return NextResponse.redirect(url);
    }
    const allowed = pathname === "/superadmin" || pathname.startsWith("/superadmin/") || isPlatformApi
      || ["/login", "/forgot-password", "/set-password", "/auth/confirm"].includes(pathname);
    if (!allowed) return notFound();
  } else if (isPlatformApi || pathname === "/superadmin" || pathname.startsWith("/superadmin/") || (isLogin && next === "/superadmin")) {
    if (pathname === "/superadmin" && (request.method === "GET" || request.method === "HEAD")) {
      const origin = operationsAppOrigin();
      if (origin && origin !== request.nextUrl.origin) {
        const redirect = privateResponse(NextResponse.redirect(new URL("/superadmin", origin)));
        redirect.headers.set("Referrer-Policy", "no-referrer");
        return redirect;
      }
    }
    return notFound();
  }
  const businessMode = businessWorkspacesEnabled();
  if (!platformOnly && businessMode && (pathname === "/" || (isLogin && next === null))
    && (request.method === "GET" || request.method === "HEAD")) {
    const defaultEntry = businessEntryPath(businessDefaultSlug(request.nextUrl.hostname));
    if (defaultEntry) {
      const url = request.nextUrl.clone();
      url.pathname = defaultEntry;
      return privateResponse(NextResponse.redirect(url));
    }
  }
  if (pathname === "/") return response;
  // The invitation fragment is removed by the page as soon as it loads. Keep
  // the document private and prevent referrer transmission during navigation.
  if (pathname === "/accept-invite") {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  // A stale tab must not submit against a different workspace after another tab switches.
  // API handlers still authorize the session, role and selected business themselves.
  if (pathname.startsWith("/api/")) {
    const expectedBusiness = request.headers.get(BUSINESS_API_HEADER);
    if (businessMode && businessApi(pathname) && expectedBusiness !== null) {
      let matches = false;
      try { matches = validBusinessId(expectedBusiness) && expectedBusiness === requestSelection(request); }
      catch { /* Treat malformed selection as a mismatch. */ }
      if (!matches) return privateResponse(NextResponse.json({ error: "Workspace changed. Reload before continuing." }, { status: 409 }));
    }
    return response;
  }
  const scopedRoute = !platformOnly && businessMode ? parseBusinessRolePath(pathname) : null;
  if (scopedRoute) {
    const canonical = businessRolePath(scopedRoute.slug, scopedRoute.rolePath);
    if (pathname !== canonical) {
      const url = request.nextUrl.clone();
      url.pathname = canonical;
      return privateResponse(NextResponse.redirect(url));
    }
  }
  if (!platformOnly && isLogin) {
    const slug = businessMode ? businessEntrySlug(next) : null;
    const entry = slug ? businessEntryPath(slug) : null;
    if (entry) {
      const url = request.nextUrl.clone();
      url.pathname = entry;
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
    if (!(next === null && accountNotice) && !(businessMode && next === "/workspaces") && !isRoleDestination(next)) return notFound();
  }
  const isBusinessEntry = businessMode && businessEntrySlug(pathname) !== null;
  const isPlatform = pathname === "/superadmin" || pathname.startsWith("/superadmin/");
  const platformLogin = isLogin && next === "/superadmin";
  if (isPlatform && !consoleEnabled) return notFound();
  const isWorkspaces = businessMode && pathname === "/workspaces";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isBranch = pathname === "/branch" || pathname.startsWith("/branch/");
  const isEmployee = pathname === "/employee" || pathname.startsWith("/employee/");
  const protectedRoute = isAdmin || isBranch || isEmployee || isWorkspaces || isPlatform;
  if (!SUPABASE_CONFIGURED) {
    return protectedRoute || isBusinessEntry || scopedRoute ? new NextResponse("Application authentication is not configured.", { status: 503 }) : response;
  }
  let selection: string | null = null;
  let invalidSelection = false;
  try {
    if (businessMode && !isWorkspaces && !isBusinessEntry && !isPlatform && !platformLogin) selection = requestSelection(request);
  } catch {
    invalidSelection = true;
  }
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: selection ? { [BUSINESS_HEADER]: selection } : {} },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const redirect = (path: string, reason?: string) => {
    const url = new URL(path, request.url);
    if (reason) url.searchParams.set("reason", reason);
    if (path === "/login" && protectedRoute) url.searchParams.set("next", isPlatform ? "/superadmin" : pathname);
    const result = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (scopedRoute) {
    const scopedUrl = request.nextUrl.clone();
    scopedUrl.searchParams.delete("_rsc");
    scopedUrl.searchParams.delete("next");
    const continuation = scopedUrl.pathname + scopedUrl.search;
    const rewrite = (path: string, query: URLSearchParams) => {
      const url = request.nextUrl.clone();
      url.pathname = path;
      url.search = query.toString();
      const result = NextResponse.rewrite(url, { request: { headers: request.headers } });
      response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return privateResponse(result);
    };
    const entry = () => {
      const query = new URLSearchParams(request.nextUrl.search);
      query.set("next", continuation);
      return rewrite(businessEntryPath(scopedRoute.slug)!, query);
    };

    if (!user || authError || !selection) return entry();
    const { business, profile, error } = await loadSessionProfile(supabase, user.id);
    const role = activeRole(error ? null : profile);
    if (!role || business?.slug !== scopedRoute.slug || business.id !== selection) return entry();

    const page = businessRolePage(scopedRoute.rolePath, role);
    if (page) return rewrite(page, request.nextUrl.searchParams);
    return privateResponse(redirect(businessRoleDestination(scopedRoute.slug, continuation, role)));
  }
  if ((isWorkspaces || (businessMode && isLogin && next === "/workspaces")) && (!user || authError)) {
    const result = privateResponse(notFound());
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  }
  if (protectedRoute && (!user || authError)) return redirect("/login");
  if (invalidSelection && user && !authError && !isLogin) return privateResponse(redirect("/workspaces"));
  if (isBusinessEntry) return response;
  if (isPlatform) {
    const permission = await supabase.rpc("platform_is_administrator");
    return !permission.error && permission.data === true ? response : new NextResponse("Platform access is required.", { status: 403 });
  }
  if (user && !authError && platformLogin && consoleEnabled) {
    const permission = await supabase.rpc("platform_is_administrator");
    if (!permission.error && permission.data === true) return redirect("/superadmin");
    return response;
  }
  if (isWorkspaces && user && !authError) return privateResponse(response);
  if (businessMode && isLogin && next === "/workspaces" && user && !authError) return redirect("/workspaces");
  if (user && (protectedRoute || isLogin)) {
    const { profile, business, error } = await loadSessionProfile(supabase, user.id);
    const role = activeRole(error ? null : profile);
    if (!role) {
      if (businessMode) return redirect("/workspaces");
      await supabase.auth.signOut({ scope: "local" });
      if (protectedRoute) return redirect("/login", "account_inactive");
      return response;
    }
    if (isLogin) {
      const destination = safeNextPath(next, role);
      return business ? privateResponse(redirect(businessRolePath(business.slug, destination))) : redirect(destination);
    }
    const wrongRole = (isAdmin && role !== "CENTRAL_ADMIN") || (isBranch && role !== "BRANCH_MANAGER") || (isEmployee && role !== "BRANCH_EMPLOYEE");
    if (business && wrongRole) return privateResponse(redirect(businessRolePath(business.slug, userHome(role))));
    if (business) return privateResponse(response);
    if (wrongRole) return redirect(userHome(role));
  }
  return response;
}

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|aaha-logo\\.(?:png|svg)$|(?:window|vercel|next|globe|file)\\.svg$).*)"] };
