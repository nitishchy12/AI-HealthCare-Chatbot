import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Navbar() {
  const { token, user, logout } = useAuth();

  return (
    <nav className="nav">
      <Link to="/" className="brand">HealthBot</Link>
      <div className="nav-links">
        {token && <Link to="/dashboard">Dashboard</Link>}
        {token && <Link to="/chat">Chat</Link>}
        <Link to="/hospitals">Hospitals</Link>
        {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
        {token ? <button onClick={logout}>Logout</button> : <Link to="/login">Login</Link>}
      </div>
    </nav>
  );
}

export default Navbar;
