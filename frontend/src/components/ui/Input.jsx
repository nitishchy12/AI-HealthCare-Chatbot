import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const Input = forwardRef(({
  label,
  error,
  helper,
  required,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-primary dark:text-text-dark">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full h-10 px-3 rounded text-sm bg-white dark:bg-surface-dark border transition-colors duration-150',
          'placeholder:text-text-subtle dark:placeholder:text-text-subtle',
          'text-text-primary dark:text-text-dark',
          error
            ? 'border-danger focus:outline-none focus:ring-2 focus:ring-danger/40'
            : 'border-border dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger flex items-center gap-1">{error}</p>}
      {!error && helper && <p className="text-xs text-text-muted">{helper}</p>}
    </div>
  );
});
Input.displayName = 'Input';

export default Input;
