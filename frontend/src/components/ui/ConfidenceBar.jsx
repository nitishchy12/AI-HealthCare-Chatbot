import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

const getColor = (confidence, riskLevel) => {
  if (riskLevel === 'High')   return 'bg-danger';
  if (riskLevel === 'Medium') return 'bg-warning';
  if (confidence >= 0.75)     return 'bg-success';
  if (confidence >= 0.5)      return 'bg-warning';
  return 'bg-danger';
};

export default function ConfidenceBar({ confidence = 0, riskLevel = 'Low', className }) {
  const pct    = Math.round(Math.min(Math.max(confidence, 0), 1) * 100);
  const color  = getColor(confidence, riskLevel);
  const label  = confidence >= 0.75 ? 'High confidence' : confidence >= 0.5 ? 'Moderate confidence' : 'Low confidence';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-border dark:bg-border-dark overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <span className="text-xs text-text-muted whitespace-nowrap tabular-nums">
        {pct}% · {label}
      </span>
    </div>
  );
}
