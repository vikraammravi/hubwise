import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "./page";

it("shows a neutral Hubwise page that points people to their business's own link", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "Open your business's link" })).toBeInTheDocument();
  expect(screen.getAllByText("Hubwise").length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toMatch(/aaha|ahaa/i);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
