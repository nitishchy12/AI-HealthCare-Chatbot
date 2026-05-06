import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import CodeBlock from './CodeBlock';
import { cn } from '../../lib/cn';

export default function MarkdownRenderer({ content = '', className }) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code({ inline, className, children, ...props }) {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sm font-mono text-primary"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0 text-text-primary dark:text-text-dark leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-3 space-y-1 text-text-primary dark:text-text-dark">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-3 space-y-1 text-text-primary dark:text-text-dark">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm leading-relaxed">{children}</li>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-text-primary dark:text-text-dark">{children}</strong>;
          },
          h1({ children }) { return <h1 className="text-xl font-bold mb-3 text-text-primary dark:text-text-dark">{children}</h1>; },
          h2({ children }) { return <h2 className="text-lg font-semibold mb-2 text-text-primary dark:text-text-dark">{children}</h2>; },
          h3({ children }) { return <h3 className="text-base font-semibold mb-2 text-text-primary dark:text-text-dark">{children}</h3>; },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/40 pl-4 my-3 text-text-muted italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
