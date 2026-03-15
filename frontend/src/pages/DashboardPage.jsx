import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getHealthHistory, getHealthTips } from '../services/health.service';

function DashboardPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [historyRes, tipsRes] = await Promise.allSettled([getHealthHistory(), getHealthTips()]);
      if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data.slice(0, 3));
      if (tipsRes.status === 'fulfilled') setTips(tipsRes.value.data.slice(0, 3));
    };

    load();
  }, []);

  return (
    <section className="page dashboard-grid">
      <div className="card hero-card">
        <p className="eyebrow">Public Health Assistant</p>
        <h2>Welcome, {user?.name}</h2>
        <p>Use the platform to check symptoms, ask health questions, review your records, and find the right hospital support.</p>
        <div className="actions">
          <Link className="btn" to="/chat">Open Chatbot</Link>
          <Link className="btn secondary-btn" to="/symptom-checker">Start Symptom Check</Link>
          <Link className="btn secondary-btn" to="/reports">View Report</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-label">Recent activities</span>
          <strong className="stat-value">{history.length}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Health tips</span>
          <strong className="stat-value">{tips.length}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Admin access</span>
          <strong className="stat-value">{user?.role === 'admin' ? 'Enabled' : 'User'}</strong>
        </div>
      </div>

      <div className="card">
        <h3>Quick Navigation</h3>
        <div className="actions">
          <Link className="btn secondary-btn" to="/history">Health History</Link>
          <Link className="btn secondary-btn" to="/hospitals">Hospitals</Link>
          <Link className="btn secondary-btn" to="/tips">Daily Tips</Link>
          {user?.role === 'admin' && <Link className="btn secondary-btn" to="/admin">Admin Panel</Link>}
        </div>
      </div>

      <div className="card">
        <h3>Recent Health Activity</h3>
        {history.length === 0 && <p>No health activity yet.</p>}
        {history.map((item) => (
          <article key={`${item.type}-${item.id}`} className="mini-list-item">
            <strong>{item.type}</strong>
            <span>{item.title}</span>
            <span className={`pill ${item.riskLevel?.toLowerCase()}`}>{item.riskLevel}</span>
          </article>
        ))}
      </div>

      <div className="card">
        <h3>Today's Health Tips</h3>
        {tips.length === 0 && <p>No tips available.</p>}
        {tips.map((tip) => (
          <article key={tip.id} className="tip-item">
            <strong>{tip.title}</strong>
            <p>{tip.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default DashboardPage;
