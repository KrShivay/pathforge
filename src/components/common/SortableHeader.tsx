import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";

export type SortDirection = "asc" | "desc";

interface SortableHeaderProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}

export default function SortableHeader({
  label,
  active,
  direction,
  onClick,
  className = "",
}: SortableHeaderProps) {
  const Icon = active
    ? direction === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <button
      type="button"
      className={`table-sort-button ${active ? "is-active" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Sort by ${label}${active ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      <span>{label}</span>
      <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}
