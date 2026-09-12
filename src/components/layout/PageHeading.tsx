import type { ReactNode } from "react";

interface PageHeadingProps {
  title: string;
  subtitle?: string;
  /** Optional actions rendered on the right (buttons, filters). */
  actions?: ReactNode;
}

/**
 * Standard page title block. Pages lead with this so a first-time user always
 * sees where they are, now that the persistent sidebar is gone.
 */
export default function PageHeading({
  title,
  subtitle,
  actions,
}: PageHeadingProps) {
  return (
    <div className="page-heading">
      <div className="page-heading-text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-heading-actions">{actions}</div> : null}
    </div>
  );
}
