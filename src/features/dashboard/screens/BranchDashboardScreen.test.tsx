import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HeaderTitleContext } from "@/components/shared/ShellHeading";
import { branchDashboard } from "@tests/mocks/branch-dashboard";
import Home from "@/features/dashboard/screens/BranchDashboardScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, profile, workspace } from "@tests/mocks/fixtures";

it("branch home names its assigned branch and links each area",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockImplementation(table=>queryResult(table==="profiles"?profile:table==="locations"?branch:[]));db.rpc.mockImplementation(name=>queryResult(name==="branch_dashboard_summary"?branchDashboard:workspace));const setTitle=vi.fn();render(<HeaderTitleContext.Provider value={setTitle}><Home/></HeaderTitleContext.Provider>);await waitFor(()=>expect(setTitle).toHaveBeenCalledWith(expect.stringMatching(/Oshawa/)));expect(screen.getByRole("link",{name:/^Inventory/})).toHaveAttribute("href","/branch/inventory");
});

it("loads bounded dashboard data instead of order and catering histories",async()=>{
 db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
 db.from.mockImplementation(table=>queryResult(table==="profiles"?profile:[]));
 db.rpc.mockImplementation(name=>queryResult(name==="branch_dashboard_summary"?branchDashboard:workspace));
 render(<Home/>);
 await screen.findByRole("link",{name:/^Catering, 7 upcoming/});
 expect(db.rpc).toHaveBeenCalledWith("branch_dashboard_summary");
 expect(db.from.mock.calls.flat()).not.toContain("orders");
 expect(db.from.mock.calls.flat()).not.toContain("catering_events");
 expect(screen.getByRole("link",{name:/^Catering, 7 upcoming/})).toBeVisible();
});
