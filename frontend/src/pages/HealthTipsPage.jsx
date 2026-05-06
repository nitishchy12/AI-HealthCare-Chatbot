import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Bookmark, Share2, CheckCircle2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getHealthTips } from '../services/health.service';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

/* ── Category colour map ─────────────────────────────────────────── */
const CATEGORY_COLORS = {
  'General Wellness': 'bg-primary/10 text-primary',
  'Nutrition':        'bg-success/15 text-green-700 dark:text-green-400',
  'Exercise':         'bg-warning/15 text-amber-700 dark:text-amber-400',
  'Mental Health':    'bg-accent/10 text-accent',
  'Sleep':            'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  'Hygiene':          'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
  'Preventive Care':  'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || 'bg-border/60 dark:bg-border-dark text-text-muted';
}

/* ── Tip card ─────────────────────────────────────────────────────── */
function TipCard({ tip, saved, read, onSave, onRead, onShare, idx }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: idx * 0.04, duration: 0.2 }}
    >
      <Card
        padding="md"
        className={cn(
          'flex flex-col gap-3 h-full transition-all',
          read && 'opacity-60',
        )}
      >
        {/* Category badge */}
        <div className="flex items-start justify-between gap-2">
          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', categoryColor(tip.category))}>
            {tip.category || 'General Wellness'}
          </span>
          {read && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark mb-1 leading-snug">{tip.title}</h3>
          <p className="text-xs text-text-muted leading-relaxed">{tip.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1 border-t border-border/50 dark:border-border-dark/50">
          <button
            onClick={onSave}
            title={saved ? 'Unsave' : 'Save tip'}
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
              saved
                ? 'text-primary bg-primary/10'
                : 'text-text-muted hover:text-primary hover:bg-primary/8',
            )}
          >
            <Bookmark className={cn('w-3.5 h-3.5', saved && 'fill-primary')} />
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={onRead}
            title={read ? 'Mark unread' : 'Mark as read'}
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
              read
                ? 'text-success bg-success/10'
                : 'text-text-muted hover:text-success hover:bg-success/8',
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {read ? 'Read' : 'Mark read'}
          </button>
          <button
            onClick={onShare}
            title="Share tip"
            className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-text-muted hover:text-accent hover:bg-accent/8 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function HealthTipsPage() {
  const [tips,       setTips]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [category,   setCategory]   = useState('All');
  const [search,     setSearch]     = useState('');
  const [saved,      setSaved]      = useState(() => new Set(JSON.parse(localStorage.getItem('saved_tips') || '[]')));
  const [read,       setRead]       = useState(() => new Set(JSON.parse(localStorage.getItem('read_tips') || '[]')));

  useEffect(() => {
    getHealthTips()
      .then((r) => setTips(r.data || []))
      .catch(() => setTips([]))
      .finally(() => setLoading(false));
  }, []);

  // Persist saved/read to localStorage
  useEffect(() => { localStorage.setItem('saved_tips', JSON.stringify([...saved])); }, [saved]);
  useEffect(() => { localStorage.setItem('read_tips',  JSON.stringify([...read]));  }, [read]);

  const categories = useMemo(() => {
    const cats = [...new Set(tips.map((t) => t.category || 'General Wellness'))];
    return ['All', ...cats.sort()];
  }, [tips]);

  const filtered = useMemo(() => tips.filter((tip) => {
    const matchCat = category === 'All' || (tip.category || 'General Wellness') === category;
    const q = search.toLowerCase();
    const matchSearch = !q || tip.title.toLowerCase().includes(q) || tip.description?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [tips, category, search]);

  const toggleSaved = (id) => setSaved((prev) => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); toast('Tip removed from saved.'); }
    else { next.add(id); toast.success('Tip saved!'); }
    return next;
  });

  const toggleRead = (id) => setRead((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else { next.add(id); }
    return next;
  });

  const shareTip = (tip) => {
    if (navigator.share) {
      navigator.share({ title: tip.title, text: tip.description }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${tip.title}\n\n${tip.description}`).then(() => toast.success('Copied to clipboard!'));
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Daily Awareness</p>
        <h1 className="text-2xl font-bold text-text-primary dark:text-text-dark mt-1">Health Tips</h1>
        <p className="text-sm text-text-muted mt-1">
          {tips.length} tips · {saved.size} saved · {read.size} read
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tips…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                category === cat
                  ? 'bg-primary text-white border-primary'
                  : 'border-border dark:border-border-dark text-text-muted hover:border-primary',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tips grid */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={Lightbulb}
          title="No tips found"
          description={search ? 'Try a different search term.' : 'No tips in this category yet.'}
          className="py-16"
        />
      )}

      <AnimatePresence mode="popLayout">
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tip, idx) => (
              <TipCard
                key={tip.id}
                tip={tip}
                idx={idx}
                saved={saved.has(tip.id)}
                read={read.has(tip.id)}
                onSave={() => toggleSaved(tip.id)}
                onRead={() => toggleRead(tip.id)}
                onShare={() => shareTip(tip)}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
