import { cn } from '../../lib/cn';
import { ShieldCheck, ShieldAlert, ShieldX, Siren } from 'lucide-react';

const config = {
  Low:      { icon: ShieldCheck, cls: 'bg-success/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900' },
  Medium:   { icon: ShieldAlert, cls: 'bg-warning/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900' },
  High:     { icon: ShieldX,     cls: 'bg-danger/15  text-red-700   dark:text-red-400   border-red-200   dark:border-red-900' },
  Critical: { icon: Siren,       cls: 'bg-red-950/20 text-red-900   dark:text-red-300   border-red-300   dark:border-red-800 animate-pulse' },
};

export default function RiskBadge({ level = 'Low', className }) {
  const { icon: Icon, cls } = config[level] || config.Low;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
      cls, className,
    )}>
      <Icon className="w-3.5 h-3.5" />
      {level}
    </span>
  );
}
