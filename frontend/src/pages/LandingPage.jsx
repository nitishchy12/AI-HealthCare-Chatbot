import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <section className="page landing-shell">
      <div className="card landing-hero">
        <div>
          <p className="eyebrow">Health awareness platform</p>
          <h1>Understand symptoms, assess risk, and find the right care faster.</h1>
          <p>
            AI-powered health awareness platform that helps users understand symptoms,
            assess risk levels, track health history, and find nearby hospitals.
          </p>
          <div className="actions">
            <Link className="btn" to="/register">Get Started</Link>
            <Link className="btn secondary-btn" to="/login">Try Chatbot</Link>
          </div>
        </div>
        <div className="landing-side-panel">
          <strong>What this platform does</strong>
          <p>Guided symptom triage</p>
          <p>Health history tracking</p>
          <p>Risk-based reports</p>
          <p>Hospital recommendation</p>
        </div>
      </div>

      <div className="landing-grid">
        <div className="card">
          <h2>How it Works</h2>
          <p>1. Create your account and update profile details.</p>
          <p>2. Use chatbot or symptom checker for guided health awareness.</p>
          <p>3. Review your report, monitor alerts, and find hospitals by specialty.</p>
        </div>
        <div className="card">
          <h2>Platform Features</h2>
          <p>Chatbot with structured response format</p>
          <p>Symptom checker with risk scoring</p>
          <p>Reports with trends and charts</p>
          <p>Admin management for hospitals and diseases</p>
        </div>
      </div>
    </section>
  );
}

export default LandingPage;
