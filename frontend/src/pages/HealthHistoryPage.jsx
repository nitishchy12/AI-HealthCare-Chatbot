import { useEffect, useState } from 'react';
import { getHealthHistory } from '../services/health.service';

function HealthHistoryPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const load = async () => {
      const res = await getHealthHistory();
      setItems(res.data || []);
    };

    load();
  }, []);

  return (
    <section className="page card">
      <p className="eyebrow">Records</p>
      <h2>Health History</h2>
      {items.length === 0 && <p>No records found.</p>}
      {items.map((item) => (
        <article key={`${item.type}-${item.id}`} className="history-row">
          <div>
            <strong>{new Date(item.createdAt).toLocaleDateString()}</strong>
            <p>{item.title}</p>
            <span>{item.summary}</span>
          </div>
          <div className="history-meta">
            <span className="record-type">{item.type}</span>
            <span className={`pill ${item.riskLevel?.toLowerCase()}`}>{item.riskLevel}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

export default HealthHistoryPage;
