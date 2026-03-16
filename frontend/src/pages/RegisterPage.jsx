import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/health.service';
import { useAuth } from '../hooks/useAuth';

function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', age: '', gender: '', medical_notes: '', city: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await registerUser(form);
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <section className="page card">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="form">
        <input placeholder="Name" onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Email" type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input placeholder="Age" type="number" min="1" max="120" onChange={(e) => setForm({ ...form, age: Number(e.target.value) || '' })} />
        <select onChange={(e) => setForm({ ...form, gender: e.target.value })} defaultValue="">
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
        <input placeholder="City" onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <textarea placeholder="Medical notes" onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} />
        <input placeholder="Password (8+, 1 uppercase, 1 number)" type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn" type="submit">Create Account</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>Already registered? <Link to="/login">Login</Link></p>
    </section>
  );
}

export default RegisterPage;
