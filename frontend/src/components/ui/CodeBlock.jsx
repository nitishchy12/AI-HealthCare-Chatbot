import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');

  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border dark:border-border-dark">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-border dark:border-border-dark">
        <span className="text-xs text-text-muted font-mono">{className?.replace('language-', '') || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary dark:hover:text-text-dark transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 bg-slate-50 dark:bg-slate-900 text-sm font-mono text-text-primary dark:text-text-dark leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
