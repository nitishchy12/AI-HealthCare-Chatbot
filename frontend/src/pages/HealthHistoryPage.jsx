import { useEffect, useState, useMemo } from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { MessageSquare, Activity, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { getHealthHistory } from '../services/health.service';
import RiskBadge from '../components/ui/RiskBadge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { cn } from '../lib/cn';

const TYPE_ICONS = {
  Chat:           MessageSquare,
  'Symptom Check': Activity,
};

const RISK_FILTERS = ['All', 'High', 'Medium', 'Low'];
const TYPE_FILTERS = ['All', 'Chat', 'Symptom Check'];

function groupByDate(items) {
  const groups = {};
  items.forEach((item) => {
    const d = new Date(item.createdAt);
    let label;
    if (isToday(d))           label = 'Today';
    else if (isYesterday(d))  label = 'Yesterday';
    else if (isThisWeek(d))   label = 'This Week';
    else                      label = format(d, 'MMMM yyyy');
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  return groups;
}

function HistoryRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[item.type] || MessageSquare;

  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className={cn(
        'absolute left-0 top-3 w-3 h-3 rounded-full border-2 border-white dark:border-background-dark',
        item.riskLevel === 'High'   ? 'bg-danger'
        : item.riskLevel === 'Medium' ? 'bg-warning'
        : 'bg-success',
      )} />

      <div
        className="bg-white dark:bg-surface-dark rounded-xl border border-border dark:border-border-dark p-4 mb-3 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary dark:text-text-dark truncate">{item.title}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a')} · {item.type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.riskLevel && <RiskBadge level={item.riskLevel} />}
            {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </div>
        </div>

        {expanded && item.summary && (
          <div className="mt-3 pt-3 border-t border-border/60 dark:border-border-dark/60">
            <p className="text-sm text-text-muted leading-relaxed">{item.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HealthHistoryPage() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');

  useEffect(() => {
    getHealthHistory()
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    if (typeFilter !== 'All' && item.type !== typeFilter) return false;
    if (riskFilter !== 'All' && item.riskLevel !== riskFilter) return false;
    return true;
  }), [items, typeFilter, riskFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const exportCSV = () => {
    const rows = [['Date', 'Type', 'Title', 'Risk Level', 'Summary']];
    items.forEach((i) => rows.push([
      format(new Date(i.createdAt), 'yyyy-MM-dd HH:mm'),
      i.type, i.title, i.riskLevel || '', i.summary || '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'health-history.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Records</p>
          <h1 className="text-2xl font-bold text-text-primary dark:text-text-dark mt-1">Health History</h1>
          <p className="text-sm text-text-muted mt-1">{items.length} record{items.length !== 1 ? 's' : ''} total</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCSV} className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs text-text-muted font-medium">Type:</span>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                typeFilter === f
                  ? 'bg-primary text-white border-primary'
                  : 'border-border dark:border-border-dark text-text-muted hover:border-primary',
              )}
            >{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted font-medium">Risk:</span>
          {RISK_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                riskFilter === f
                  ? 'bg-primary text-white border-primary'
                  : 'border-border dark:border-border-dark text-text-muted hover:border-primary',
              )}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="No records found"
          description={items.length > 0 ? 'Try adjusting your filters.' : 'Your health history will appear here after your first chat or symptom check.'}
        />
      )}

      {/* Timeline */}
      {!loading && Object.entries(grouped).map(([dateLabel, groupItems]) => (
        <div key={dateLabel} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{dateLabel}</span>
            <div className="flex-1 h-px bg-border dark:bg-border-dark" />
          </div>
          {/* Timeline line */}
          <div className="relative ml-1.5 border-l-2 border-border dark:border-border-dark pl-0">
            {groupItems.map((item) => (
              <HistoryRow key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
