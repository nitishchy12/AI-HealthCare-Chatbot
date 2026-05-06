import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/cn';
import Spinner from './Spinner';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-sm hover:shadow-md',
  secondary: 'bg-white dark:bg-surface-dark text-primary border border-primary hover:bg-primary-light dark:hover:bg-primary/10 shadow-sm',
  ghost: 'text-text-muted hover:text-text-primary hover:bg-border/40 dark:hover:bg-border-dark/60',
  danger: 'bg-danger text-white hover:bg-red-600 active:scale-[0.98] shadow-sm',
  accent: 'bg-accent text-white hover:bg-accent-hover active:scale-[0.98] shadow-sm',
};

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-sm gap-1.5',
  md: 'h-10 px-4 text-sm rounded gap-2',
  lg: 'h-12 px-6 text-base rounded-lg gap-2.5',
};

const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  asChild = false,
  className,
  children,
  ...props
}, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </Comp>
  );
});
Button.displayName = 'Button';

export default Button;
