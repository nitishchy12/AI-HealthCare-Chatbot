import { useEffect, useState } from 'react';
import { BarChart, Bar, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getHealthReport } from '../services/health.service';

function HealthReportsPage() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await getHealthReport();
      setReport(res.data);
    };

    load();
  }, []);

  return (
    <section className="page card print-card">
      <div className="report-header">
        <div>
          <p className="eyebrow">AI Summary</p>
          <h2>Health Report</h2>
        </div>
        <button className="btn" type="button" onClick={() => window.print()}>Download PDF Report</button>
      </div>
      {!report && <p>Generating report...</p>}
      {report && (
        <>
          <div className="report-grid">
            <div className="soft-panel">
              <h3>Recent Symptoms</h3>
              {report.recentSymptoms.map((item) => <p key={item}>{item}</p>)}
            </div>
            <div className="soft-panel">
              <h3>Risk Trend</h3>
              <p>{report.riskTrend}</p>
              <p>Recent chats: {report.recentChatsCount}</p>
              <p>Symptom checks: {report.recentSymptomChecksCount}</p>
            </div>
          </div>
          <div className="soft-panel">
            <h3>Recommendations</h3>
            {report.recommendations.map((item) => <p key={item}>{item}</p>)}
          </div>
          <div className="report-grid charts-grid">
            <div className="soft-panel chart-panel">
              <h3>Most Common Symptoms</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={report.symptomChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0c5d56" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="soft-panel chart-panel">
              <h3>User Activity</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={report.activityChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#f0c66a" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default HealthReportsPage;
