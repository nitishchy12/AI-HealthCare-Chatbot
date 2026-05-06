import { Suspense, lazy, useEffect, useState } from 'react';
import { Activity, BarChart2, Brain, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { downloadReportPdf, getHealthReport, getReportInsights } from '../services/health.service';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import RiskBadge from '../components/ui/RiskBadge';
import Skeleton from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

const HealthReportCharts = lazy(() => import('../components/HealthReportCharts'));

const TABS = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'symptoms', label: 'Symptoms', icon: Activity },
  { id: 'trends', label: 'Trends', icon: BarChart2 },
  { id: 'insights', label: 'AI Insights', icon: Brain },
];

function StatCard({ label, value, sub }) {
  return (
    <Card padding="md" className="text-center">
      <p className="mb-1 text-xs uppercase tracking-wider text-text-muted">{label}</p>
      <div className="text-2xl font-bold text-text-primary dark:text-text-dark">{value}</div>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </Card>
  );
}

function InsightPanel({ active }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await getReportInsights(refresh);
      setInsights(response.data);
    } catch {
      setError('Could not load AI insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active && !insights && !loading) load(false);
  }, [active]);

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          <h3 className="text-base font-semibold text-text-primary dark:text-text-dark">AI Insights</h3>
        </div>
        <Button variant="secondary" size="sm" onClick={() => load(true)} loading={loading} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh Insights
        </Button>
      </div>
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-8/12" />
        </div>
      )}
      {error && <p className="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {!loading && insights && (
        <>
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
            <p className="text-sm leading-6 text-text-primary dark:text-text-dark">{insights.summary}</p>
            <p className="mt-3 text-sm font-medium text-primary">{insights.recommendation}</p>
          </div>
          {(insights.anomalies || []).length > 0 && (
            <div className="space-y-2">
              {insights.anomalies.map((item) => (
                <div key={item.symptom || item.message} className="rounded border border-warning/30 bg-warning/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                  {item.message}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function HealthReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    getHealthReport()
      .then((response) => setReport(response.data))
      .catch(() => setError('Could not load your health report.'))
      .finally(() => setLoading(false));
  }, []);

  const downloadPdf = async () => {
    const response = await downloadReportPdf();
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'health-report.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const recentRecommendation = report?.recommendations?.[0] || 'No recent recommendation yet.';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">AI Summary</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary dark:text-text-dark">Health Report</h1>
        </div>
        <Button variant="secondary" size="sm" onClick={downloadPdf} className="shrink-0 gap-2">
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-border/30 p-1 dark:bg-border-dark/30">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-primary shadow-sm dark:bg-surface-dark' : 'text-text-muted hover:text-text-primary dark:hover:text-text-dark',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-lg" />)}
        </div>
      )}

      {error && <p className="rounded border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</p>}

      {report && (
        <>
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Current Risk" value={<RiskBadge level={report.currentRisk || 'Low'} />} />
                <StatCard label="Total Chats" value={report.recentChatsCount || 0} />
                <StatCard label="Symptom Checks" value={report.recentSymptomChecksCount || 0} />
                <StatCard label="Symptoms" value={report.recentSymptoms?.length || 0} sub="unique recent" />
              </div>
              <Card padding="lg" className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary dark:text-text-dark">Risk Trend</h3>
                <p className="text-sm text-text-muted">{report.riskTrend || 'Low'}</p>
              </Card>
              <Card padding="lg" className="space-y-3">
                <h3 className="text-base font-semibold text-text-primary dark:text-text-dark">Most Recent Recommendation</h3>
                <p className="text-sm text-text-primary dark:text-text-dark">{recentRecommendation}</p>
              </Card>
            </div>
          )}

          {tab === 'symptoms' && (
            <Card padding="lg">
              <h3 className="mb-4 text-base font-semibold text-text-primary dark:text-text-dark">Most Common Symptoms</h3>
              <Suspense fallback={<Skeleton className="h-64" />}>
                <HealthReportCharts symptomChart={report.symptomChart || []} showOnly="symptom" />
              </Suspense>
            </Card>
          )}

          {tab === 'trends' && (
            <div className="space-y-4">
              <Card padding="lg">
                <h3 className="mb-4 text-base font-semibold text-text-primary dark:text-text-dark">Risk Trend</h3>
                <Suspense fallback={<Skeleton className="h-64" />}>
                  <HealthReportCharts riskChart={report.riskChart || []} showOnly="risk" />
                </Suspense>
              </Card>
              <Card padding="lg">
                <h3 className="mb-4 text-base font-semibold text-text-primary dark:text-text-dark">Activity Heatmap</h3>
                <Suspense fallback={<Skeleton className="h-24" />}>
                  <HealthReportCharts activityChart={report.activityChart || []} showOnly="heatmap" />
                </Suspense>
              </Card>
            </div>
          )}

          {tab === 'insights' && <InsightPanel active={tab === 'insights'} />}
        </>
      )}
    </div>
  );
}
