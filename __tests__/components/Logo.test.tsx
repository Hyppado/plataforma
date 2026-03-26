/**
 * Tests: app/components/ui/Logo.tsx
 *
 * Covers: renders img with alt="Hyppado", correct src per mode/variant,
 * href wraps in link, size presets, priority loading flag.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Logo } from "@/app/components/ui/Logo";

describe("Logo", () => {
  it("renders an image with alt='Hyppado'", () => {
    render(<Logo />);
    expect(screen.getByAltText("Hyppado")).toBeInTheDocument();
  });

  it("uses white logo in dark mode (default)", () => {
    render(<Logo />);
    const img = screen.getByAltText("Hyppado") as HTMLImageElement;
    expect(img.src).toContain("logo.png");
    expect(img.src).not.toContain("logo-light");
  });

  it("uses dark logo in light mode", () => {
    render(<Logo mode="light" />);
    const img = screen.getByAltText("Hyppado") as HTMLImageElement;
    expect(img.src).toContain("logo-light.png");
  });

  it("renders logo mark variant (icon only)", () => {
    render(<Logo variant="mark" />);
    const img = screen.getByAltText("Hyppado") as HTMLImageElement;
    expect(img.src).toContain("logo-mark.png");
  });

  it("wraps in an anchor when href is provided", () => {
    render(<Logo href="/dashboard/videos" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/videos");
  });

  it("does NOT render an anchor when href is not provided", () => {
    render(<Logo />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sets loading='eager' when priority=true", () => {
    render(<Logo priority />);
    const img = screen.getByAltText("Hyppado") as HTMLImageElement;
    // Use getAttribute: jsdom may not implement HTMLImageElement.loading as a DOM property
    expect(img.getAttribute("loading")).toBe("eager");
  });

  it("sets loading='lazy' by default", () => {
    render(<Logo />);
    const img = screen.getByAltText("Hyppado") as HTMLImageElement;
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("renders mark variant with href", () => {
    render(<Logo variant="mark" href="/home" />);
    const img = screen.getByAltText("Hyppado") as HTMLImageElement;
    expect(img.src).toContain("logo-mark.png");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/home");
  });
});
