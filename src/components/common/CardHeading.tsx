import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface CardHeadingProps {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: "accent" | "warning";
}

/** Shared icon-first heading for application cards. */
export default function CardHeading({
  icon: Icon,
  title,
  subtitle,
  tone = "accent",
}: CardHeadingProps) {
  return (
    <div className={`card-heading tone-${tone}`}>
      <span className="card-heading-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="card-heading-copy">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}
