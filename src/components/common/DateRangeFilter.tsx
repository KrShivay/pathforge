import { CalendarDays, X } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useState } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

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

function toPickerDate(value: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function toFilterValue(value: Date | null) {
  return value && isValid(value) ? format(value, "yyyy-MM-dd") : "";
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
  const labelId = `${id}-label`;
  const hasValue = Boolean(from || to);
  const [openPicker, setOpenPicker] = useState<"from" | "to" | null>(null);
  const fromDate = toPickerDate(from);
  const toDate = toPickerDate(to);

  function open(field: "from" | "to") {
    setOpenPicker(field);
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div
        className={`date-range-filter${invalid ? " is-invalid" : ""}`}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={invalid ? errorId : undefined}
      >
        <span className="date-range-label" id={labelId}>
          <CalendarDays size={14} aria-hidden="true" />
          <span>Date range</span>
        </span>
        <div className="date-range-fields">
          <label htmlFor={fromId}>
            <span>{fromLabel}</span>
            <DatePicker
              value={fromDate}
              maxDate={toDate ?? undefined}
              onChange={(value) => {
                const nextFrom = toFilterValue(value);
                if (nextFrom && to && nextFrom > to) onToChange("");
                onFromChange(nextFrom);
              }}
              format="dd MMM yyyy"
              open={openPicker === "from"}
              onOpen={() => open("from")}
              onClose={() => setOpenPicker(null)}
              slotProps={{
                field: {
                  readOnly: true,
                  onClick: () => open("from"),
                  "aria-label": fromLabel,
                  "aria-invalid": invalid,
                },
                textField: {
                  id: fromId,
                  fullWidth: true,
                  onClick: () => open("from"),
                },
                popper: { className: "pf-date-picker-popper" },
              }}
            />
          </label>
          <span className="date-range-to" aria-hidden="true">
            to
          </span>
          <label htmlFor={toId}>
            <span>{toLabel}</span>
            <DatePicker
              value={toDate}
              onChange={(value) => onToChange(toFilterValue(value))}
              minDate={fromDate ?? undefined}
              format="dd MMM yyyy"
              open={openPicker === "to"}
              onOpen={() => open("to")}
              onClose={() => setOpenPicker(null)}
              slotProps={{
                field: {
                  readOnly: true,
                  onClick: () => open("to"),
                  "aria-label": toLabel,
                  "aria-invalid": invalid,
                },
                textField: {
                  id: toId,
                  fullWidth: true,
                  onClick: () => open("to"),
                },
                popper: { className: "pf-date-picker-popper" },
              }}
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
      </div>
    </LocalizationProvider>
  );
}
