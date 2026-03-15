import { useState } from 'react';
import { getHospitalsByCity } from '../services/health.service';

function HospitalsPage() {
  const [city, setCity] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [list, setList] = useState([]);
  const [error, setError] = useState('');

  const onSearch = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await getHospitalsByCity(city, specialization);
      setList(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch hospitals');
      setList([]);
    }
  };

  return (
    <section className="page card">
      <p className="eyebrow">Care Finder</p>
      <h2>Recommended Hospitals</h2>
      <form onSubmit={onSearch} className="form-inline">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city name" required />
        <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Specialist e.g. Cardiologist" />
        <button className="btn" type="submit">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="list">
        {list.map((h) => (
          <article key={h.id} className="chat-item">
            <p><strong>{h.name}</strong> <span className="rating-badge">⭐ {h.rating}</span></p>
            <p>{h.address}, {h.city}</p>
            <p>{h.phone}</p>
            <p><strong>Recommended Specialist:</strong> {h.specialization}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HospitalsPage;
