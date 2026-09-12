import { CalendarDays, X } from "lucide-react";

interface DateRangeFilterProps {
  id: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  invalid?: boolean;
}

export default function DateRangeFilter({
  id,
  from,
  to,
  fromLabel,
  toLabel,
  onFromChange,
  onToChange,
  invalid = false,
}: DateRangeFilterProps) {
  const fromId = `${id}-from`;
  const toId = `${id}-to`;
  const errorId = `${id}-error`;
  const hasValue = Boolean(from || to);

  return (
    <fieldset
      className={`date-range-filter${invalid ? " is-invalid" : ""}`}
      aria-describedby={invalid ? errorId : undefined}
    >
      <legend>
        <CalendarDays size={14} aria-hidden="true" />
        Date range
      </legend>
      <div className="date-range-fields">
        <label htmlFor={fromId}>
          <span>{fromLabel}</span>
          <input
            id={fromId}
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            aria-invalid={invalid}
          />
        </label>
        <span className="date-range-to" aria-hidden="true">
          to
        </span>
        <label htmlFor={toId}>
          <span>{toLabel}</span>
          <input
            id={toId}
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            aria-invalid={invalid}
          />
        </label>
      </div>
      <div className="date-range-footer">
        {invalid ? (
          <p id={errorId} className="form-error" role="alert">
            End date must be on or after the start date.
          </p>
        ) : (
          <span className="date-range-hint">Includes the full end date.</span>
        )}
        {hasValue ? (
          <button
            type="button"
            className="date-range-clear"
            onClick={() => {
              onFromChange("");
              onToChange("");
            }}
          >
            <X size={13} aria-hidden="true" />
            Clear dates
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
