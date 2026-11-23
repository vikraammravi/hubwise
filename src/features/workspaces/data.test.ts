import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { businessId, businessWorkspace, otherBusinessId, workspaceProfile } from "@tests/mocks/workspaces";
import { chooseWorkspace } from "./data";
import { saveBusinessSelection } from "./selection";
import { setDisplayedBusiness } from "./fetch";

vi.mock("./fetch", () => ({ setDisplayedBusiness: vi.fn() }));

beforeEach(() => {
  saveBusinessSelection(null);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
});

it("preserves a newer workspace selection when an older selection fails", async () => {
  db.rpc.mockImplementation(() => {
    saveBusinessSelection(otherBusinessId);
    return queryResult(null, { message: "Workspace changed." });
  });
  await expect(chooseWorkspace(businessId)).rejects.toThrow("Workspace changed.");
  expect(document.cookie).toContain(`ahaa_business=${otherBusinessId}`);
  expect(setDisplayedBusiness).not.toHaveBeenCalledWith(null);
});

it("preserves a concurrent selection of the same workspace when the pending selection is canceled", async () => {
  const controller = new AbortController();
  const request = queryResult(businessWorkspace);
  request.abortSignal.mockImplementation(() => {
    expect(document.cookie).not.toContain("ahaa_business=");
    saveBusinessSelection(businessId);
    controller.abort();
    return request;
  });
  db.rpc.mockReturnValue(request);

  await expect(chooseWorkspace(businessId, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(request.setHeader).toHaveBeenCalledWith("x-business-id", businessId);
  expect(document.cookie).toContain(`ahaa_business=${businessId}`);
  expect(setDisplayedBusiness).not.toHaveBeenCalled();
});

it("does not overwrite a different workspace selected during verification", async () => {
  const request = queryResult(businessWorkspace);
  request.setHeader.mockImplementation(() => {
    saveBusinessSelection(otherBusinessId);
    return request;
  });
  db.rpc.mockReturnValue(request);

  await expect(chooseWorkspace(businessId)).rejects.toThrow("Workspace changed");
  expect(document.cookie).toContain(`ahaa_business=${otherBusinessId}`);
  expect(setDisplayedBusiness).not.toHaveBeenCalled();
});
