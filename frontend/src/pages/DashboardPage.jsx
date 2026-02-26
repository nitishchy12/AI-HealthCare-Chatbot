import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function DashboardPage() {
  const { user } = useAuth();

  return (
    <section className="page card">
      <h2>Welcome, {user?.name}</h2>
      <p>Use quick actions below to navigate the project.</p>
      <div className="actions">
        <Link className="btn" to="/chat">Open Chatbot</Link>
        <Link className="btn" to="/hospitals">Find Hospitals</Link>
        {user?.role === 'admin' && <Link className="btn" to="/admin">Open Admin Panel</Link>}
      </div>
    </section>
  );
}

export default DashboardPage;
