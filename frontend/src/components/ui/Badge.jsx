import { cn } from '../../lib/cn';

const variants = {
  default:  'bg-border/60 dark:bg-border-dark text-text-muted',
  success:  'bg-success/15 text-green-700 dark:text-green-400',
  warning:  'bg-warning/15 text-amber-700 dark:text-amber-400',
  danger:   'bg-danger/15 text-red-700 dark:text-red-400',
  accent:   'bg-accent/15 text-accent dark:text-indigo-400',
  primary:  'bg-primary/15 text-primary dark:text-teal-400',
};

export default function Badge({ variant = 'default', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
