export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`pf-skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonList({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`pf-skeleton-list ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pf-skeleton-list-item">
          <Skeleton className="pf-skeleton-avatar" />
          <div className="pf-skeleton-lines">
            <Skeleton className="pf-skeleton-line-primary" />
            <Skeleton className="pf-skeleton-line-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
