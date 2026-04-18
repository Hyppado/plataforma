/**
 * Tests: app/components/filters/TimeRangeSelect.tsx
 *
 * Covers: renders with correct label, all 4 options present,
 * onChange fired on selection, disabled state.
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TimeRangeSelect } from "@/app/components/filters/TimeRangeSelect";

describe("TimeRangeSelect", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <TimeRangeSelect value="7d" onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("reflects the current value via aria-label", () => {
    render(<TimeRangeSelect value="7d" onChange={vi.fn()} />);
    // aria-label is set to "Período: <label>"
    const el = screen.getByLabelText(/Período/i);
    expect(el).toBeInTheDocument();
  });

  it("aria-label updates when value changes to 30d", () => {
    render(<TimeRangeSelect value="30d" onChange={vi.fn()} />);
    expect(
      screen.getByLabelText(/Período: Últimos 30 dias/i),
    ).toBeInTheDocument();
  });

  it("aria-label updates when value changes to 1d", () => {
    render(<TimeRangeSelect value="1d" onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Período: Último dia/i)).toBeInTheDocument();
  });

  it("renders all 3 time range options inside the select", () => {
    render(<TimeRangeSelect value="7d" onChange={vi.fn()} />);
    // Open the select to make options visible in DOM
    const select = screen.getByRole("combobox");
    fireEvent.mouseDown(select);

    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(3);
  });

  it("shows '7d' option as selected", () => {
    render(<TimeRangeSelect value="7d" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    fireEvent.mouseDown(select);

    const listbox = screen.getByRole("listbox");
    const selected = within(listbox).getByRole("option", {
      name: "Últimos 7 dias",
    });
    expect(selected).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange with the new value on selection", () => {
    const onChange = vi.fn();
    render(<TimeRangeSelect value="7d" onChange={onChange} />);

    const select = screen.getByRole("combobox");
    fireEvent.mouseDown(select);

    const listbox = screen.getByRole("listbox");
    const option30d = within(listbox).getByRole("option", {
      name: "Últimos 30 dias",
    });
    fireEvent.click(option30d);

    expect(onChange).toHaveBeenCalledWith("30d");
  });


  it("disables the select when disabled=true", () => {
    render(<TimeRangeSelect value="7d" onChange={vi.fn()} disabled />);
    // MUI Select root gets the aria-disabled attribute when disabled
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-disabled", "true");
  });
});
