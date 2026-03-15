import { useEffect, useState } from 'react';
import { getHealthTips } from '../services/health.service';

function HealthTipsPage() {
  const [tips, setTips] = useState([]);

  useEffect(() => {
    const load = async () => {
      const res = await getHealthTips();
      setTips(res.data || []);
    };

    load();
  }, []);

  return (
    <section className="page card">
      <p className="eyebrow">Daily Awareness</p>
      <h2>Health Tips</h2>
      <div className="tips-grid">
        {tips.map((tip) => (
          <article key={tip.id} className="tip-card">
            <span className="record-type">{tip.category}</span>
            <h3>{tip.title}</h3>
            <p>{tip.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HealthTipsPage;
