import React from "react";
import type { Nutrients } from "../types";
import "./FoodResultRow.css";

export interface FoodResultRowProps {
  name: string;
  /** Brand, if any. Absence is what makes an entry "generic". */
  brand?: string | null;
  /** Label for what the macros are measured against, e.g. "100 g" or "1 serving". */
  basisLabel: string;
  macros: Nutrients;
  /** Shows a spinner in place of the calorie figure while details load. */
  loading?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

const round = (n: number | undefined): number => Math.round(n ?? 0);

/**
 * A single food search result.
 *
 * Every row carries enough information to choose without opening it -- name,
 * what the numbers are measured against, all three macros, and calories. The
 * point is that five results can be compared in place; opening a food should be
 * for adjusting the serving, not for finding out what it contains.
 *
 * Unbranded entries are marked "Generic" because the ranking deliberately
 * floats them above branded ones (see utils/foodSearch.ts). Without the label
 * that ordering looks arbitrary; with it, the list explains itself.
 */
const FoodResultRow: React.FC<FoodResultRowProps> = ({
  name,
  brand,
  basisLabel,
  macros,
  loading = false,
  disabled = false,
  onSelect,
}) => {
  const isGeneric = !brand;

  return (
    <button
      type="button"
      className={`mp-result${isGeneric ? " mp-result--generic" : ""}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="mp-result__body">
        <span className="mp-result__name">
          {name || "(no name)"}
          {brand ? <em className="mp-result__brand"> ({brand})</em> : null}
          {isGeneric ? <span className="mp-result__tag">Generic</span> : null}
        </span>
        <span className="mp-result__macros">
          Per {basisLabel} · P {round(macros.protein)}g · C {round(macros.carbs)}g · F{" "}
          {round(macros.fat)}g
        </span>
      </span>

      <span className="mp-result__kcal">
        {loading ? (
          <span className="mp-result__spinner" role="status" aria-label="Loading" />
        ) : (
          <>
            <b>{round(macros.calories)}</b>
            <span className="mp-result__kcal-unit">kcal</span>
          </>
        )}
      </span>
    </button>
  );
};

export default FoodResultRow;
