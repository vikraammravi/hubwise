import { expect, it } from "vitest";
import { businessEntrySlug, parseWorkspace, selectedBusiness } from "./context";
import { businessEntryPath } from "./business-address";
import { businessId, businessWorkspace, workspaceProfile } from "@tests/mocks/workspaces";

it("treats selection as an untrusted preference and rejects malformed or duplicate cookies", () => {
  expect(selectedBusiness(`other=value; ahaa_business=${businessId}`)).toBe(businessId);
  expect(selectedBusiness("other=value")).toBeNull();
  for (const cookie of ["ahaa_business=bad", "ahaa_business=%ZZ", `ahaa_business=${businessId}; ahaa_business=${businessId}`]) {
    expect(() => selectedBusiness(cookie)).toThrow("Invalid workspace selection");
  }
});
it("accepts only local, canonical business entry paths", () => {
  expect(businessEntrySlug("/example-business")).toBe("example-business");
  expect(businessEntryPath("example-business")).toBe("/example-business");
  expect(businessEntryPath("login")).toBeNull();
  for (const path of [null,"/", "/login", "/admin", "/superadmin", "//other.test/b/example", "/b/example-business", "/b/a", "/b/Example", "/b/example/../admin", "/b/example?next=//other.test", "/b/%2fexample", "/%2fexample", `/${"a".repeat(61)}`]) expect(businessEntrySlug(path)).toBeNull();
});

it("keeps Ahaa's workspace identity behind the /aaha sign-in address", () => {
  expect(businessEntryPath("ahaa")).toBe("/aaha");
  expect(businessEntrySlug("/aaha")).toBe("ahaa");
  expect(businessEntrySlug("/ahaa")).toBe("ahaa");
  expect(businessEntrySlug("/b/ahaa")).toBeNull();
});

it("requires an active, correctly assigned profile belonging to the authenticated identity", () => {
  expect(parseWorkspace(businessWorkspace, workspaceProfile.id)).toEqual(businessWorkspace);
  for (const value of [null, {}, { ...businessWorkspace, profile: { ...workspaceProfile, status: "disabled" } },
    { ...businessWorkspace, profile: { ...workspaceProfile, location_id: null } },
    { ...businessWorkspace, business: { ...businessWorkspace.business, id: "invalid" } }]) {
    expect(() => parseWorkspace(value, workspaceProfile.id)).toThrow("Workspace access");
  }
  expect(() => parseWorkspace(businessWorkspace, "different-user")).toThrow("Workspace access");
});
