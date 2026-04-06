/**
 * Tests: Echotik admin sections — RegionSection + HealthSection
 *
 * RegionSection: compact Popover dropdown (trigger + dropdown list)
 * HealthSection: operational table with full task labels
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RegionSection } from "@/app/components/admin/echotik/RegionSection";
import { HealthSection } from "@/app/components/admin/echotik/HealthSection";
import type { EchotikHealthResponse } from "@/lib/types/echotik-admin";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REGIONS = [
  { code: "BR", name: "Brasil", isActive: true, sortOrder: 0 },
  { code: "US", name: "United States", isActive: true, sortOrder: 1 },
  { code: "JP", name: "Japan", isActive: false, sortOrder: 2 },
];

const HEALTH_DATA: EchotikHealthResponse = {
  summary: {
    totalCombinations: 6,
    healthy: 4,
    stale: 1,
    failing: 1,
    neverRun: 0,
    inactive: 0,
    mostStale: null,
    activeRegionsCount: 2,
  },
  tasks: [
    {
      source: "echotik:categories",
      task: "categories",
      region: null,
      regionName: null,
      isRegionActive: true,
      isTaskEnabled: true,
      status: "healthy" as const,
      lastSuccessAt: "2025-01-15T10:00:00Z",
      lastFailureAt: null,
      lastRunAt: "2025-01-15T10:00:00Z",
      lastRunStatus: "SUCCESS",
      hoursSinceSuccess: 2,
      stalenessRatio: 0.01,
      failures24h: 0,
      lastErrorMessage: null,
      lastItemsProcessed: 20,
      lastPagesProcessed: 1,
      lastDurationMs: 1200,
    },
    {
      source: "echotik:videos:BR",
      task: "videos",
      region: "BR",
      regionName: "Brasil",
      isRegionActive: true,
      isTaskEnabled: true,
      status: "healthy" as const,
      lastSuccessAt: "2025-01-15T10:00:00Z",
      lastFailureAt: null,
      lastRunAt: "2025-01-15T10:00:00Z",
      lastRunStatus: "SUCCESS",
      hoursSinceSuccess: 2,
      stalenessRatio: 0.08,
      failures24h: 0,
      lastErrorMessage: null,
      lastItemsProcessed: 50,
      lastPagesProcessed: 5,
      lastDurationMs: 5000,
    },
    {
      source: "echotik:products:BR",
      task: "products",
      region: "BR",
      regionName: "Brasil",
      isRegionActive: true,
      isTaskEnabled: true,
      status: "stale" as const,
      lastSuccessAt: "2025-01-14T10:00:00Z",
      lastFailureAt: null,
      lastRunAt: "2025-01-14T10:00:00Z",
      lastRunStatus: "SUCCESS",
      hoursSinceSuccess: 26,
      stalenessRatio: 1.08,
      failures24h: 0,
      lastErrorMessage: null,
      lastItemsProcessed: 30,
      lastPagesProcessed: 3,
      lastDurationMs: 3000,
    },
    {
      source: "echotik:creators:BR",
      task: "creators",
      region: "BR",
      regionName: "Brasil",
      isRegionActive: true,
      isTaskEnabled: true,
      status: "failing" as const,
      lastSuccessAt: null,
      lastFailureAt: "2025-01-15T09:00:00Z",
      lastRunAt: "2025-01-15T09:00:00Z",
      lastRunStatus: "FAILED",
      hoursSinceSuccess: null,
      stalenessRatio: null,
      failures24h: 3,
      lastErrorMessage: "Connection timeout",
      lastItemsProcessed: 0,
      lastPagesProcessed: 0,
      lastDurationMs: null,
    },
  ],
  generatedAt: "2025-01-15T10:05:00Z",
};

// ---------------------------------------------------------------------------
// RegionSection
// ---------------------------------------------------------------------------

describe("RegionSection", () => {
  const onToggle = vi.fn().mockResolvedValue(undefined);

  it("renders loading skeleton when loading", () => {
    render(
      <RegionSection regions={undefined} loading={true} onToggle={onToggle} />,
    );
    // Skeleton is an MUI Skeleton, verify no region text is shown
    expect(screen.queryByText(/de/)).not.toBeInTheDocument();
  });

  it("shows compact trigger with active count", () => {
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );
    // "2 de 3" — 2 active out of 3
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
  });

  it("shows region dropdown button with aria-label", () => {
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );
    expect(
      screen.getByRole("button", { name: "Gerenciar regiões" }),
    ).toBeInTheDocument();
  });

  it("opens popover on click and shows all regions", async () => {
    const user = userEvent.setup();
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole("button", { name: "Gerenciar regiões" }));

    // Popover content should now show region names
    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.getByText("Japan")).toBeInTheDocument();
  });

  it("shows region codes in dropdown", async () => {
    const user = userEvent.setup();
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole("button", { name: "Gerenciar regiões" }));

    expect(screen.getByText("BR")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("renders switches for each region in dropdown", async () => {
    const user = userEvent.setup();
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole("button", { name: "Gerenciar regiões" }));

    const switches = screen.getAllByRole("checkbox");
    expect(switches).toHaveLength(3);
    // BR and US are active, JP is not
    expect(switches[0]).toBeChecked(); // BR
    expect(switches[1]).toBeChecked(); // US
    expect(switches[2]).not.toBeChecked(); // JP
  });

  it("calls onToggle when a switch is toggled", async () => {
    const user = userEvent.setup();
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole("button", { name: "Gerenciar regiões" }));

    const switches = screen.getAllByRole("checkbox");
    await user.click(switches[2]); // Toggle JP (inactive → active)

    expect(onToggle).toHaveBeenCalledWith("JP", true);
  });

  it("displays summary text in popover header", async () => {
    const user = userEvent.setup();
    render(
      <RegionSection regions={REGIONS} loading={false} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole("button", { name: "Gerenciar regiões" }));

    expect(screen.getByText(/2 ativas de 3/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HealthSection — TASK_LABELS
// ---------------------------------------------------------------------------

describe("HealthSection", () => {
  it("renders loading skeleton when loading", () => {
    render(<HealthSection data={undefined} loading={true} />);
    expect(screen.queryByText("Visão Operacional")).not.toBeInTheDocument();
  });

  it("renders nothing when data is undefined and not loading", () => {
    const { container } = render(
      <HealthSection data={undefined} loading={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it('uses full label "Categorias" instead of abbreviated "Cat"', () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    expect(screen.getByText("Categorias")).toBeInTheDocument();
    expect(screen.queryByText("Cat")).not.toBeInTheDocument();
  });

  it('uses full label "Produtos" instead of abbreviated "Prod"', () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    expect(screen.getByText("Produtos")).toBeInTheDocument();
    expect(screen.queryByText("Prod")).not.toBeInTheDocument();
  });

  it('uses full label "Criadores" instead of English "Creators"', () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    expect(screen.getByText("Criadores")).toBeInTheDocument();
    expect(screen.queryByText("Creators")).not.toBeInTheDocument();
  });

  it("uses Vídeos label for video tasks", () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    expect(screen.getByText("Vídeos")).toBeInTheDocument();
  });

  it('displays "Nunca falhou" for regions without failures', () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    // Categories (global) has no lastFailureAt — should show "Nunca falhou"
    expect(screen.getByText("Nunca falhou")).toBeInTheDocument();
    // Old text should not appear
    expect(screen.queryByText("Nenhuma")).not.toBeInTheDocument();
  });

  it("renders the operational header title", () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    expect(screen.getByText("Visão Operacional")).toBeInTheDocument();
  });

  it("renders summary counters in subheader", () => {
    render(<HealthSection data={HEALTH_DATA} loading={false} />);
    const subheader = screen.getByText(/OK.*desatualizados.*falhas/);
    expect(subheader).toBeInTheDocument();
  });
});
