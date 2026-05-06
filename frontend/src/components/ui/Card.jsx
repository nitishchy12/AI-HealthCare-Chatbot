import { cn } from '../../lib/cn';

const padding = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export default function Card({ children, className, padding: p = 'md', ...props }) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark shadow-md',
        padding[p],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
