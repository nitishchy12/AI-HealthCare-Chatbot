import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare, Activity, BarChart2, Hospital,
  Lightbulb, Shield, ArrowRight, TrendingUp, Flame, Clock, Bell,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { getHealthHistory, getHealthTips, getNotifications } from '../services/health.service';
import RiskBadge from '../components/ui/RiskBadge';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { cn } from '../lib/cn';

function computeHealthScore(items) {
  if (!items.length) return 85;
  const scores = items.slice(0, 10).map((i) =>
    i.riskLevel === 'High' ? 30 : i.riskLevel === 'Medium' ? 65 : 90,
  );
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function StatCard({ icon: Icon, label, value, sub, iconBg, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}>
      <Card padding="md" className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-muted truncate">{label}</p>
          <p className="text-xl font-bold text-text-primary dark:text-text-dark leading-tight">{value}</p>
          {sub && <p className="text-xs text-text-subtle">{sub}</p>}
        </div>
      </Card>
    </motion.div>
  );
}

function QuickAction({ to, icon: Icon, label, color }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark hover:border-primary/40 hover:shadow-md transition-all hover:scale-105 active:scale-100">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-xs font-medium text-text-primary dark:text-text-dark text-center leading-tight">{label}</span>
    </Link>
  );
}

function ActivityRow({ item }) {
  const Icon = item.type === 'Chat' ? MessageSquare : Activity;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 dark:border-border-dark/50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary dark:text-text-dark truncate">{item.title}</p>
        <p className="text-xs text-text-muted">
          {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ''}
        </p>
      </div>
      {item.riskLevel && <RiskBadge level={item.riskLevel} />}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [history,       setHistory]       = useState([]);
  const [tips,          setTips]          = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.allSettled([getHealthHistory(), getHealthTips(), getNotifications()])
      .then(([h, t, n]) => {
        if (h.status === 'fulfilled') setHistory(h.value.data || []);
        if (t.status === 'fulfilled') setTips(t.value.data || []);
        if (n.status === 'fulfilled') setNotifications(n.value.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const firstName   = user?.first_name || user?.name?.split(' ')[0] || 'there';
  const healthScore = computeHealthScore(history);
  const scoreColor  = healthScore >= 75 ? 'text-success' : healthScore >= 50 ? 'text-warning' : 'text-danger';
  const recentHigh  = history.find((i) => i.riskLevel === 'High');

  const h = new Date().getHours();
  const greeting = h < 12 ? t.goodMorning : h < 17 ? t.goodAfternoon : t.goodEvening;

  const quickActions = [
    { to: '/chat',            icon: MessageSquare, label: t.aiChat,       color: 'bg-primary'  },
    { to: '/symptom-checker', icon: Activity,      label: t.symptoms,     color: 'bg-accent'   },
    { to: '/reports',         icon: BarChart2,     label: t.reports,      color: 'bg-success'  },
    { to: '/hospitals',       icon: Hospital,      label: t.hospitals,    color: 'bg-warning'  },
    { to: '/tips',            icon: Lightbulb,     label: t.healthTips,   color: 'bg-primary'  },
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: Shield, label: t.admin, color: 'bg-danger' }] : []),
  ];

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

      {/* Hero greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card padding="lg" className="bg-gradient-to-br from-primary to-[#0D5F58] text-white border-0 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium">{greeting},</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">{firstName} 👋</h1>
              <p className="text-white/80 text-sm mt-2 max-w-md">
                {recentHigh
                  ? `${t.recentHighRisk} ${formatDistanceToNow(new Date(recentHigh.createdAt), { addSuffix: true })}. ${t.howAreYouFeeling}`
                  : t.welcomeBack}
              </p>
            </div>
            <Link to="/chat">
              <Button className="shrink-0 gap-2 !bg-white/20 hover:!bg-white/30 !text-white !border-white/30 !shadow-none">
                {t.openChat} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Health Score — custom render */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card padding="md" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className={cn('w-5 h-5', scoreColor)} />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t.healthScore}</p>
                <p className={cn('text-xl font-bold leading-tight', scoreColor)}>{healthScore}<span className="text-xs text-text-muted font-normal">/100</span></p>
              </div>
            </Card>
          </motion.div>
          <StatCard icon={Flame}    label={t.activeStreak}   value={`${Math.min(history.length, 7)}d`}  sub={t.daysEngaged}   iconBg="bg-warning" delay={0.05} />
          <StatCard icon={Clock}    label={t.healthRecords}  value={history.length}                       sub={t.totalEntries}  iconBg="bg-accent"  delay={0.1}  />
          <StatCard icon={Bell}     label={t.notifications}  value={notifications.length}                 sub={t.newUpdates}    iconBg="bg-primary" delay={0.15} />
        </div>
      )}

      {/* Quick actions */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">{t.quickActions}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {quickActions.map((a) => <QuickAction key={a.to} {...a} />)}
        </div>
      </Card>

      {/* Activity + Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">{t.recentActivity}</h2>
            <Link to="/history" className="text-xs text-primary hover:underline flex items-center gap-1">
              {t.viewAll} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg mb-2" />)}
          {!loading && history.length === 0 && (
            <p className="text-sm text-text-muted py-8 text-center">{t.noActivityYet}</p>
          )}
          {!loading && history.slice(0, 5).map((item) => (
            <ActivityRow key={`${item.type}-${item.id}`} item={item} />
          ))}
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">{t.todaysTips}</h2>
            <Link to="/tips" className="text-xs text-primary hover:underline flex items-center gap-1">
              {t.allTips} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg mb-2" />)}
          {!loading && tips.length === 0 && (
            <p className="text-sm text-text-muted py-8 text-center">{t.noTipsAvailable}</p>
          )}
          {!loading && tips.slice(0, 3).map((tip) => (
            <div key={tip.id} className="py-3 border-b border-border/50 dark:border-border-dark/50 last:border-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                {tip.category || t.wellness}
              </span>
              <p className="text-sm font-medium text-text-primary dark:text-text-dark mt-1">{tip.title}</p>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{tip.description}</p>
            </div>
          ))}
        </Card>

      </div>

      {/* Notifications */}
      {!loading && notifications.length > 0 && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">{t.notifications}</h2>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/10">
                <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  {item.type && <p className="text-xs font-semibold text-accent uppercase tracking-wider">{item.type}</p>}
                  <p className="text-sm text-text-primary dark:text-text-dark mt-0.5">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
