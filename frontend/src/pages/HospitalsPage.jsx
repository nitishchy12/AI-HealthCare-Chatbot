import { useState } from 'react';
import { getHospitalsByCity } from '../services/health.service';

function HospitalsPage() {
  const [city, setCity] = useState('');
  const [list, setList] = useState([]);
  const [error, setError] = useState('');

  const onSearch = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await getHospitalsByCity(city);
      setList(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch hospitals');
      setList([]);
    }
  };

  return (
    <section className="page card">
      <h2>Hospital Search</h2>
      <form onSubmit={onSearch} className="form-inline">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city name" required />
        <button className="btn" type="submit">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="list">
        {list.map((h) => (
          <article key={h.id} className="chat-item">
            <p><strong>{h.name}</strong></p>
            <p>{h.address}, {h.city}</p>
            <p>{h.phone}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HospitalsPage;
