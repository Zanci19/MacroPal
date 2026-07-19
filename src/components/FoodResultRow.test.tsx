import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FoodResultRow from "./FoodResultRow";

const MACROS = { calories: 195, protein: 29.55, carbs: 0, fat: 7.72 };

describe("FoodResultRow", () => {
  it("shows enough to choose without opening the food", () => {
    render(
      <FoodResultRow
        name="Chicken breast"
        basisLabel="100 g"
        macros={MACROS}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/Chicken breast/)).toBeInTheDocument();
    expect(screen.getByText("195")).toBeInTheDocument();
    // Macros are rounded for scanning, not shown to two decimals.
    expect(screen.getByText(/P 30g · C 0g · F 8g/)).toBeInTheDocument();
  });

  it("labels the basis the macros are actually measured against", () => {
    // Regression: the previous row rendered "Per serving: 45 g" above numbers
    // that were still per 100 g.
    render(
      <FoodResultRow
        name="Oats"
        basisLabel="100 g"
        macros={MACROS}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/Per 100 g/)).toBeInTheDocument();
    expect(screen.queryByText(/Per serving/)).not.toBeInTheDocument();
  });

  it("marks unbranded entries generic, explaining why they rank first", () => {
    const { rerender } = render(
      <FoodResultRow name="Chicken breast" basisLabel="100 g" macros={MACROS} onSelect={() => {}} />
    );
    expect(screen.getByText("Generic")).toBeInTheDocument();

    rerender(
      <FoodResultRow
        name="Chicken breast"
        brand="Kirkland Signature"
        basisLabel="100 g"
        macros={MACROS}
        onSelect={() => {}}
      />
    );
    expect(screen.queryByText("Generic")).not.toBeInTheDocument();
    expect(screen.getByText(/\(Kirkland Signature\)/)).toBeInTheDocument();
  });

  it("calls onSelect when activated", async () => {
    const onSelect = vi.fn();
    render(
      <FoodResultRow name="Oats" basisLabel="100 g" macros={MACROS} onSelect={onSelect} />
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("is keyboard reachable and activates on Enter", async () => {
    const onSelect = vi.fn();
    render(
      <FoodResultRow name="Oats" basisLabel="100 g" macros={MACROS} onSelect={onSelect} />
    );
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not fire while another row is loading", async () => {
    const onSelect = vi.fn();
    render(
      <FoodResultRow
        name="Oats"
        basisLabel="100 g"
        macros={MACROS}
        disabled
        onSelect={onSelect}
      />
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("replaces the calorie figure with a spinner while loading", () => {
    render(
      <FoodResultRow
        name="Oats"
        basisLabel="100 g"
        macros={MACROS}
        loading
        onSelect={() => {}}
      />
    );
    expect(screen.queryByText("195")).not.toBeInTheDocument();
  });

  it("handles a missing name and empty nutriments without crashing", () => {
    // nutrientsFromNutriments zero-fills the four primaries when a product has
    // no nutrition data, so this is the real shape of a data-less result.
    render(
      <FoodResultRow
        name=""
        basisLabel="100 g"
        macros={{ calories: 0, protein: 0, carbs: 0, fat: 0 }}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("(no name)")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/P 0g · C 0g · F 0g/)).toBeInTheDocument();
  });
});
