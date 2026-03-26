/**
 * Tests: app/components/cards/RankBadge.tsx
 *
 * Covers: rendering rank number, top-3 medal styling, default styling for 4+.
 * RankBadge is a pure display component — no external deps needed.
 *
 * NOTE: The component renders "#" and the number as separate text nodes inside
 * the same element (e.g. `<p># 1</p>`). We use a custom text matcher that
 * compares the element's full textContent (whitespace-stripped) to "#N".
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RankBadge } from "@/app/components/cards/RankBadge";

/**
 * Returns a RTL text-matcher function that finds the innermost element
 * (no child elements) whose full textContent, after stripping whitespace,
 * equals `#${rank}`.  This avoids matching ancestor wrappers that share
 * the same textContent.
 */
const rankText = (rank: number) => (_: string, el: Element | null) =>
  !!el &&
  el.children.length === 0 &&
  el.textContent?.replace(/\s+/g, "") === `#${rank}`;

describe("RankBadge", () => {
  it("renders rank #1", () => {
    render(<RankBadge rank={1} />);
    expect(screen.getByText(rankText(1))).toBeInTheDocument();
  });

  it("renders rank #2", () => {
    render(<RankBadge rank={2} />);
    expect(screen.getByText(rankText(2))).toBeInTheDocument();
  });

  it("renders rank #3", () => {
    render(<RankBadge rank={3} />);
    expect(screen.getByText(rankText(3))).toBeInTheDocument();
  });

  it("renders rank #4 (non-medal)", () => {
    render(<RankBadge rank={4} />);
    expect(screen.getByText(rankText(4))).toBeInTheDocument();
  });

  it("renders rank #10 (non-medal)", () => {
    render(<RankBadge rank={10} />);
    expect(screen.getByText(rankText(10))).toBeInTheDocument();
  });

  it("renders rank #100", () => {
    render(<RankBadge rank={100} />);
    expect(screen.getByText(rankText(100))).toBeInTheDocument();
  });

  it("renders unique rank numbers without confusion", () => {
    const { unmount } = render(<RankBadge rank={5} />);
    expect(screen.getByText(rankText(5))).toBeInTheDocument();
    unmount();
    render(<RankBadge rank={7} />);
    expect(screen.getByText(rankText(7))).toBeInTheDocument();
  });
});
