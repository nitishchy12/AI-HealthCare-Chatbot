import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <section className="page card">
      <h1>AI-Driven Public Health Chatbot</h1>
      <p>This project helps users ask health-related questions and get structured awareness-level responses.</p>
      <p>It also provides symptom guidance, risk level indication, and nearby hospital search by city.</p>
      <Link className="btn" to="/chat">Start Chat</Link>
    </section>
  );
}

export default LandingPage;
