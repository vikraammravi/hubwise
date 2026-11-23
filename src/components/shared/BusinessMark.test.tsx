import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BusinessMark } from "./BusinessMark";

it("shows the business's own logo with an accessible name", () => {
  render(<BusinessMark name="Spice Route" logoUrl="https://cdn.example.invalid/logo.png" accent="#0ea5e9" />);
  expect(screen.getByRole("img", { name: "Spice Route logo" })).toHaveAttribute("src", "https://cdn.example.invalid/logo.png");
  expect(screen.getByText("Spice Route")).toBeInTheDocument();
  expect(screen.queryByText("SR")).not.toBeInTheDocument();
});

it("falls back to initials on the accent colour, or a neutral colour", () => {
  const { container, rerender } = render(<BusinessMark name="spice  route kitchens" accent="#0ea5e9" />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  const initials = screen.getByText("SR");
  expect(initials).toHaveAttribute("aria-hidden");
  expect(initials).toHaveStyle({ backgroundColor: "#0ea5e9" });
  rerender(<BusinessMark name="Solo" />);
  expect(screen.getByText("S")).toHaveStyle({ backgroundColor: "#334155" });
  rerender(<BusinessMark name="   " />);
  expect(screen.getByText("?")).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/Aaha|Ahaa/);
});
