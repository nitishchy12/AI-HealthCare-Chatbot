import { cn } from '../../lib/cn';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-border/40 dark:bg-border-dark flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-text-muted" />
        </div>
      )}
      <p className="text-base font-semibold text-text-primary dark:text-text-dark mb-1">{title}</p>
      {description && <p className="text-sm text-text-muted max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
