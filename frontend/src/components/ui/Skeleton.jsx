import { cn } from '../../lib/cn';

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded bg-gradient-to-r from-border via-slate-200 to-border dark:from-border-dark dark:via-slate-700 dark:to-border-dark bg-[length:200%_100%] animate-shimmer',
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark shadow-sm p-6 space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}
