/** Session unknown -> shaped placeholder -> resolved content. No artificial delay. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`loading-skeleton ${className}`} aria-hidden="true" />;
}

export function SessionSkeleton({ variant }: { variant: 'actions' | 'account' | 'assets' }) {
  return (
    <div
      className={`session-placeholder ${variant}-placeholder`}
      role="status"
      aria-label={variant === 'account' ? 'Loading your account' : 'Loading your wallet'}
    >
      {variant === 'actions' ? (
        <SkeletonActions />
      ) : variant === 'account' ? (
        <>
          <div className="account-title" aria-hidden="true">
            <Skeleton className="profile-avatar" />
            <h1>
              <Skeleton className="skeleton-heading" />
            </h1>
            <p>
              <Skeleton className="skeleton-caption" />
            </p>
          </div>
          <div className="account-panel wallet-panel" aria-hidden="true">
            <h2>
              <Skeleton className="skeleton-title" />
            </h2>
            <div className="wallet-address">
              <Skeleton className="skeleton-address" />
            </div>
            <SkeletonActions />
          </div>
        </>
      ) : (
        <>
          <div className="balance-label" aria-hidden="true">
            <Skeleton className="skeleton-label" />
          </div>
          <div className="asset-value" aria-hidden="true">
            <Skeleton className="skeleton-amount" />
            <small>
              <Skeleton className="skeleton-unit" />
            </small>
          </div>
          <SkeletonActions />
        </>
      )}
    </div>
  );
}

function SkeletonActions() {
  return (
    <div className="two-actions" aria-hidden="true">
      <Skeleton className="skeleton-button" />
      <Skeleton className="skeleton-button" />
    </div>
  );
}
