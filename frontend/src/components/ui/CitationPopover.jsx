import { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function CitationPopover({ citation }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold cursor-pointer transition-colors mx-0.5',
          open
            ? 'bg-primary text-white'
            : 'bg-primary/15 text-primary hover:bg-primary/25',
        )}
        aria-label={`Citation ${citation.id}`}
      >
        {citation.id}
      </button>

      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-xl p-3 text-left animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-xs font-semibold text-text-primary dark:text-text-dark">{citation.source}</p>
            {citation.url && (
              <a href={citation.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-primary hover:text-primary-hover transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <p className="text-xs text-text-muted leading-relaxed line-clamp-4">{citation.snippet}</p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0
            border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent
            border-t-white dark:border-t-surface-dark" />
        </div>
      )}
    </span>
  );
}
