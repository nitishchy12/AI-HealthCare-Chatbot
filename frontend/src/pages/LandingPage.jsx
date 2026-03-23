import { Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';

function LandingPage() {
  const { t } = useLanguage();

  return (
    <section className="page landing-shell">
      <div className="card landing-hero">
        <div>
          <p className="eyebrow">{t.landingEyebrow}</p>
          <h1>{t.landingTitle}</h1>
          <p>{t.landingBody}</p>
          <div className="actions">
            <Link className="btn" to="/register">{t.getStarted}</Link>
            <Link className="btn secondary-btn" to="/login">{t.tryChatbot}</Link>
          </div>
        </div>
        <div className="landing-side-panel">
          <strong>{t.whatPlatformDoes}</strong>
          <p>{t.guidedTriage}</p>
          <p>{t.historyTracking}</p>
          <p>{t.riskReports}</p>
          <p>{t.hospitalRecommendation}</p>
        </div>
      </div>

      <div className="landing-grid">
        <div className="card">
          <h2>{t.howItWorks}</h2>
          <p>{t.howStep1}</p>
          <p>{t.howStep2}</p>
          <p>{t.howStep3}</p>
        </div>
        <div className="card">
          <h2>{t.features}</h2>
          <p>{t.feature1}</p>
          <p>{t.feature2}</p>
          <p>{t.feature3}</p>
          <p>{t.feature4}</p>
        </div>
      </div>
    </section>
  );
}

export default LandingPage;
