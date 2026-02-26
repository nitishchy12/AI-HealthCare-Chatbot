import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../services/health.service';
import { useAuth } from '../hooks/useAuth';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await loginUser(form);
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <section className="page card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="form">
        <input placeholder="Email" type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input placeholder="Password" type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn" type="submit">Login</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>New user? <Link to="/register">Create account</Link></p>
    </section>
  );
}

export default LoginPage;
