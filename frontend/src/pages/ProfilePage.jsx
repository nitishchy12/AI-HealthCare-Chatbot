import { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '../services/health.service';
import { useAuth } from '../hooks/useAuth';

function ProfilePage() {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ name: '', age: '', gender: '', medical_notes: '', city: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const res = await getProfile();
      setForm({
        name: res.data?.name || '',
        age: res.data?.age || '',
        gender: res.data?.gender || '',
        medical_notes: res.data?.medical_notes || '',
        city: res.data?.city || ''
      });
    };

    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await updateProfile({ ...form, age: form.age ? Number(form.age) : null });
    updateUser(res.data);
    setMessage('Profile updated successfully');
  };

  return (
    <section className="page card">
      <p className="eyebrow">Account</p>
      <h2>User Profile</h2>
      <form className="form" onSubmit={handleSubmit}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
        <input value={form.age} type="number" min="1" max="120" onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Age" />
        <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
        <textarea value={form.medical_notes} onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} placeholder="Medical notes" />
        <button className="btn" type="submit">Save Profile</button>
      </form>
      {message && <p className="success">{message}</p>}
    </section>
  );
}

export default ProfilePage;
