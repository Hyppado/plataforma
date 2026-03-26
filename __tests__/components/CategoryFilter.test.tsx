/**
 * Tests: app/components/filters/CategoryFilter.tsx
 *
 * Covers: renders trigger label, opens/closes on click,
 * lists all categories, fires onChange, "Todas" resets selection,
 * disabled state blocks interaction.
 *
 * NOTE: The trigger button shows `selectedLabel ?? "Categoria"`.
 * When value is empty, it shows "Categoria" (placeholder).
 * The "Todas" / allLabel option appears INSIDE the popover dropdown,
 * which is only rendered in the DOM when open=true.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CategoryFilter } from "@/app/components/filters/CategoryFilter";

const STRING_CATEGORIES = ["Beauty", "Fashion", "Tech", "Sports"];

/** Open the popover by clicking the lone trigger button. */
async function openDropdown() {
  await userEvent.click(screen.getByRole("button"));
}

describe("CategoryFilter — string categories", () => {
  it("renders trigger button with 'Categoria' placeholder when no value selected", () => {
    render(
      <CategoryFilter
        value=""
        onChange={vi.fn()}
        categories={STRING_CATEGORIES}
      />,
    );
    // Trigger shows placeholder when nothing is selected
    expect(screen.getByText("Categoria")).toBeInTheDocument();
  });

  it("shows selected category in the trigger button", () => {
    render(
      <CategoryFilter
        value="Beauty"
        onChange={vi.fn()}
        categories={STRING_CATEGORIES}
      />,
    );
    expect(screen.getByText("Beauty")).toBeInTheDocument();
  });

  it("opens the dropdown when trigger is clicked and shows allLabel inside", async () => {
    render(
      <CategoryFilter
        value=""
        onChange={vi.fn()}
        categories={STRING_CATEGORIES}
      />,
    );
    await openDropdown();

    // "Todas" is the default allLabel, rendered inside the popover
    await waitFor(() => {
      expect(screen.getByText("Todas")).toBeInTheDocument();
    });
  });

  it("respects a custom allLabel inside the dropdown", async () => {
    render(
      <CategoryFilter
        value=""
        onChange={vi.fn()}
        categories={STRING_CATEGORIES}
        allLabel="All"
      />,
    );
    await openDropdown();

    await waitFor(() => {
      expect(screen.getByText("All")).toBeInTheDocument();
    });
  });

  it("lists all string categories in dropdown after opening", async () => {
    render(
      <CategoryFilter
        value=""
        onChange={vi.fn()}
        categories={STRING_CATEGORIES}
      />,
    );
    await openDropdown();

    for (const cat of STRING_CATEGORIES) {
      await waitFor(() =>
        expect(screen.getAllByText(cat).length).toBeGreaterThanOrEqual(1),
      );
    }
  });

  it("calls onChange with selected category string", async () => {
    const onChange = vi.fn();
    render(
      <CategoryFilter
        value=""
        onChange={onChange}
        categories={STRING_CATEGORIES}
      />,
    );
    await openDropdown();

    await waitFor(() => expect(screen.getByText("Tech")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Tech"));

    expect(onChange).toHaveBeenCalledWith("Tech");
  });

  it("calls onChange with empty string when 'Todas' is clicked", async () => {
    const onChange = vi.fn();
    render(
      <CategoryFilter
        value="Beauty"
        onChange={onChange}
        categories={STRING_CATEGORIES}
      />,
    );
    // Trigger shows the selected name — click it to open
    await userEvent.click(screen.getByText("Beauty").closest("button")!);

    await waitFor(() =>
      expect(screen.getAllByText("Todas").length).toBeGreaterThan(0),
    );
    const allItems = screen.getAllByText("Todas");
    await userEvent.click(allItems[allItems.length - 1]);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders without crashing when categories is empty", () => {
    render(<CategoryFilter value="" onChange={vi.fn()} categories={[]} />);
    // The trigger button must still be present
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("is disabled when disabled=true", () => {
    const onChange = vi.fn();
    render(
      <CategoryFilter
        value=""
        onChange={onChange}
        categories={STRING_CATEGORIES}
        disabled
      />,
    );
    // ButtonBase with disabled=true sets disabled attribute and pointer-events:none
    expect(screen.getByRole("button")).toBeDisabled();
    // No category items should be visible (popover is not open)
    expect(screen.queryByText("Beauty")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
