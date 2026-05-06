import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const riskLabel = { 0: 'Low', 1: 'Medium', 2: 'High' };
const riskDot = { Low: '#16a34a', Medium: '#f59e0b', High: '#dc2626' };

function EmptyChart({ message }) {
  return (
    <div className="flex h-64 items-center justify-center rounded border border-dashed border-border text-sm text-text-muted dark:border-border-dark">
      {message}
    </div>
  );
}

function SymptomBarChart({ data = [] }) {
  if (!data.length) return <EmptyChart message="No symptom data yet." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}`, 'Count']} />
        <Bar dataKey="value" fill="#0F766E" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RiskLineChart({ data = [] }) {
  if (!data.length) return <EmptyChart message="No risk trend data yet." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis ticks={[0, 1, 2]} tickFormatter={(value) => riskLabel[value]} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value, _name, item) => [riskLabel[value], item.payload.level || 'Risk']} />
        <Line
          type="monotone"
          dataKey="risk"
          stroke="#0F766E"
          strokeWidth={3}
          dot={({ cx, cy, payload }) => (
            <circle cx={cx} cy={cy} r={5} fill={riskDot[payload.level] || '#0F766E'} stroke="#fff" strokeWidth={2} />
          )}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function buildHeatmap(activity = []) {
  const counts = new Map(activity.map((item) => [item.date, item.count]));
  const today = new Date();
  const days = [];
  for (let i = 83; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const compact = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    days.push({ label, count: counts.get(compact) || counts.get(label) || 0 });
  }
  return days;
}

const heatColor = (count) => {
  if (count >= 3) return '#0f766e';
  if (count === 2) return '#6ee7b7';
  if (count === 1) return '#a7f3d0';
  return '#f1f5f9';
};

function ActivityHeatmap({ data = [] }) {
  const days = buildHeatmap(data);
  const cell = 12;
  const gap = 4;
  return (
    <div className="overflow-x-auto">
      <svg width={12 * (cell + gap)} height={7 * (cell + gap)} role="img" aria-label="Activity heatmap">
        {days.map((day, index) => {
          const week = Math.floor(index / 7);
          const dow = index % 7;
          return (
            <rect
              key={`${day.label}-${index}`}
              x={week * (cell + gap)}
              y={dow * (cell + gap)}
              width={cell}
              height={cell}
              rx="2"
              fill={heatColor(day.count)}
            >
              <title>{day.label} - {day.count} interactions</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

export default function HealthReportCharts({
  symptomChart = [],
  riskChart = [],
  activityChart = [],
  showOnly,
}) {
  if (showOnly === 'symptom') return <SymptomBarChart data={symptomChart} />;
  if (showOnly === 'risk') return <RiskLineChart data={riskChart} />;
  if (showOnly === 'heatmap') return <ActivityHeatmap data={activityChart} />;

  return (
    <div className="grid gap-4">
      <SymptomBarChart data={symptomChart} />
      <RiskLineChart data={riskChart} />
      <ActivityHeatmap data={activityChart} />
    </div>
  );
}
