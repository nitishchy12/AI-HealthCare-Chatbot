import { useState } from 'react';
import { addDisease, addHospital } from '../services/health.service';

function AdminPage() {
  const [hospital, setHospital] = useState({ name: '', city: '', address: '', phone: '' });
  const [disease, setDisease] = useState({ disease_name: '', symptoms: '', prevention: '', treatment: '', risk_factors: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submitHospital = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await addHospital(hospital);
      setMessage('Hospital added successfully');
      setHospital({ name: '', city: '', address: '', phone: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add hospital');
    }
  };

  const submitDisease = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await addDisease(disease);
      setMessage('Disease info added successfully');
      setDisease({ disease_name: '', symptoms: '', prevention: '', treatment: '', risk_factors: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add disease info');
    }
  };

  return (
    <section className="page">
      <div className="card">
        <h2>Admin Panel</h2>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h3>Add Hospital</h3>
        <form onSubmit={submitHospital} className="form">
          <input value={hospital.name} onChange={(e) => setHospital({ ...hospital, name: e.target.value })} placeholder="Hospital name" required />
          <input value={hospital.city} onChange={(e) => setHospital({ ...hospital, city: e.target.value })} placeholder="City" required />
          <input value={hospital.address} onChange={(e) => setHospital({ ...hospital, address: e.target.value })} placeholder="Address" required />
          <input value={hospital.phone} onChange={(e) => setHospital({ ...hospital, phone: e.target.value })} placeholder="Phone" />
          <button className="btn" type="submit">Save Hospital</button>
        </form>
      </div>
      <div className="card">
        <h3>Add Disease Info</h3>
        <form onSubmit={submitDisease} className="form">
          <input value={disease.disease_name} onChange={(e) => setDisease({ ...disease, disease_name: e.target.value })} placeholder="Disease name" required />
          <textarea value={disease.symptoms} onChange={(e) => setDisease({ ...disease, symptoms: e.target.value })} placeholder="Symptoms" required />
          <textarea value={disease.prevention} onChange={(e) => setDisease({ ...disease, prevention: e.target.value })} placeholder="Prevention" required />
          <textarea value={disease.treatment} onChange={(e) => setDisease({ ...disease, treatment: e.target.value })} placeholder="Treatment" required />
          <textarea value={disease.risk_factors} onChange={(e) => setDisease({ ...disease, risk_factors: e.target.value })} placeholder="Risk factors" required />
          <button className="btn" type="submit">Save Disease Info</button>
        </form>
      </div>
    </section>
  );
}

export default AdminPage;
