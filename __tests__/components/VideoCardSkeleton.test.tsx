/**
 * Tests: app/components/cards/VideoCardSkeleton.tsx
 *
 * Covers: renders without crashing, skeleton structure present.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VideoCardSkeleton } from "@/app/components/cards/VideoCardSkeleton";

describe("VideoCardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<VideoCardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders a non-empty structure", () => {
    const { container } = render(<VideoCardSkeleton />);
    // Should have more than just the root container
    expect(container.querySelectorAll("*").length).toBeGreaterThan(2);
  });

  it("does not render any text content", () => {
    render(<VideoCardSkeleton />);
    // Skeleton is purely visual — no exposed text nodes
    const textNodes = screen
      .queryAllByRole("heading")
      .concat(screen.queryAllByRole("paragraph"));
    expect(textNodes).toHaveLength(0);
  });

  it("renders consistently on multiple mounts", () => {
    const { container: a } = render(<VideoCardSkeleton />);
    const aHtml = a.innerHTML;

    const { container: b } = render(<VideoCardSkeleton />);
    const bHtml = b.innerHTML;

    expect(aHtml).toBe(bHtml);
  });
});
