import { useEffect, useState } from 'react';
import {
  addDisease,
  addHealthTip,
  addHospital,
  deleteDisease,
  deleteHealthTip,
  deleteHospital,
  getDiseases,
  getHealthTips,
  getHospitalsByCity,
  updateDisease,
  updateHealthTip,
  updateHospital
} from '../services/health.service';

function AdminPage() {
  const [hospital, setHospital] = useState({ name: '', city: '', address: '', phone: '', specialization: '', rating: 4.2 });
  const [disease, setDisease] = useState({ disease_name: '', symptoms: '', prevention: '', treatment: '', risk_factors: '' });
  const [tip, setTip] = useState({ title: '', description: '', category: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [diseaseList, setDiseaseList] = useState([]);
  const [hospitalList, setHospitalList] = useState([]);
  const [tipList, setTipList] = useState([]);
  const [cityFilter, setCityFilter] = useState('Bhubaneswar');
  const [editingDiseaseId, setEditingDiseaseId] = useState(null);
  const [editingHospitalId, setEditingHospitalId] = useState(null);
  const [editingTipId, setEditingTipId] = useState(null);

  const resetHospital = () => setHospital({ name: '', city: '', address: '', phone: '', specialization: '', rating: 4.2 });
  const resetDisease = () => setDisease({ disease_name: '', symptoms: '', prevention: '', treatment: '', risk_factors: '' });
  const resetTip = () => setTip({ title: '', description: '', category: '' });

  const loadAdminData = async (city = cityFilter) => {
    const [diseaseRes, hospitalRes, tipRes] = await Promise.all([getDiseases(), getHospitalsByCity(city), getHealthTips()]);
    setDiseaseList(diseaseRes.data || []);
    setHospitalList(hospitalRes.data || []);
    setTipList(tipRes.data || []);
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const submitHospital = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingHospitalId) {
        await updateHospital(editingHospitalId, hospital);
        setMessage('Hospital updated successfully');
      } else {
        await addHospital(hospital);
        setMessage('Hospital added successfully');
      }
      resetHospital();
      setEditingHospitalId(null);
      await loadAdminData(hospital.city || cityFilter);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save hospital');
    }
  };

  const submitDisease = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingDiseaseId) {
        await updateDisease(editingDiseaseId, disease);
        setMessage('Disease info updated successfully');
      } else {
        await addDisease(disease);
        setMessage('Disease info added successfully');
      }
      resetDisease();
      setEditingDiseaseId(null);
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save disease info');
    }
  };

  const submitTip = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingTipId) {
        await updateHealthTip(editingTipId, tip);
        setMessage('Health tip updated successfully');
      } else {
        await addHealthTip(tip);
        setMessage('Health tip added successfully');
      }
      resetTip();
      setEditingTipId(null);
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save health tip');
    }
  };

  const handleDeleteDisease = async (id) => {
    await deleteDisease(id);
    setMessage('Disease deleted successfully');
    await loadAdminData();
  };

  const handleDeleteHospital = async (id) => {
    await deleteHospital(id);
    setMessage('Hospital deleted successfully');
    await loadAdminData();
  };

  const handleDeleteTip = async (id) => {
    await deleteHealthTip(id);
    setMessage('Health tip deleted successfully');
    await loadAdminData();
  };

  return (
    <section className="page">
      <div className="card">
        <h2>Admin Panel</h2>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h3>{editingHospitalId ? 'Edit Hospital' : 'Add Hospital'}</h3>
        <form onSubmit={submitHospital} className="form">
          <input value={hospital.name} onChange={(e) => setHospital({ ...hospital, name: e.target.value })} placeholder="Hospital name" required />
          <input value={hospital.city} onChange={(e) => setHospital({ ...hospital, city: e.target.value })} placeholder="City" required />
          <input value={hospital.address} onChange={(e) => setHospital({ ...hospital, address: e.target.value })} placeholder="Address" required />
          <input value={hospital.phone} onChange={(e) => setHospital({ ...hospital, phone: e.target.value })} placeholder="Phone" />
          <input value={hospital.specialization} onChange={(e) => setHospital({ ...hospital, specialization: e.target.value })} placeholder="Specialization" />
          <input type="number" min="1" max="5" step="0.1" value={hospital.rating} onChange={(e) => setHospital({ ...hospital, rating: Number(e.target.value) })} placeholder="Rating" />
          <button className="btn" type="submit">Save Hospital</button>
        </form>
      </div>

      <div className="card">
        <h3>{editingDiseaseId ? 'Edit Disease Info' : 'Add Disease Info'}</h3>
        <form onSubmit={submitDisease} className="form">
          <input value={disease.disease_name} onChange={(e) => setDisease({ ...disease, disease_name: e.target.value })} placeholder="Disease name" required />
          <textarea value={disease.symptoms} onChange={(e) => setDisease({ ...disease, symptoms: e.target.value })} placeholder="Symptoms" required />
          <textarea value={disease.prevention} onChange={(e) => setDisease({ ...disease, prevention: e.target.value })} placeholder="Prevention" required />
          <textarea value={disease.treatment} onChange={(e) => setDisease({ ...disease, treatment: e.target.value })} placeholder="Treatment" required />
          <textarea value={disease.risk_factors} onChange={(e) => setDisease({ ...disease, risk_factors: e.target.value })} placeholder="Risk factors" required />
          <button className="btn" type="submit">Save Disease Info</button>
        </form>
      </div>

      <div className="card">
        <h3>{editingTipId ? 'Edit Health Tip' : 'Add Health Tip'}</h3>
        <form onSubmit={submitTip} className="form">
          <input value={tip.title} onChange={(e) => setTip({ ...tip, title: e.target.value })} placeholder="Tip title" required />
          <input value={tip.category} onChange={(e) => setTip({ ...tip, category: e.target.value })} placeholder="Category" required />
          <textarea value={tip.description} onChange={(e) => setTip({ ...tip, description: e.target.value })} placeholder="Description" required />
          <button className="btn" type="submit">Save Health Tip</button>
        </form>
      </div>

      <div className="card">
        <div className="section-head">
          <h3>Manage Diseases</h3>
        </div>
        {diseaseList.map((item) => (
          <article key={item.id} className="manage-row">
            <div>
              <strong>{item.disease_name}</strong>
              <p>{item.symptoms}</p>
            </div>
            <div className="actions">
              <button type="button" className="btn secondary-btn" onClick={() => { setDisease(item); setEditingDiseaseId(item.id); }}>Edit</button>
              <button type="button" className="btn" onClick={() => handleDeleteDisease(item.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      <div className="card">
        <div className="section-head">
          <h3>Manage Hospitals</h3>
          <input value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} onBlur={() => loadAdminData(cityFilter)} placeholder="City filter" />
        </div>
        {hospitalList.map((item) => (
          <article key={item.id} className="manage-row">
            <div>
              <strong>{item.name}</strong>
              <p>{item.city} | {item.specialization} | Rating {item.rating}</p>
            </div>
            <div className="actions">
              <button type="button" className="btn secondary-btn" onClick={() => { setHospital(item); setEditingHospitalId(item.id); }}>Edit</button>
              <button type="button" className="btn" onClick={() => handleDeleteHospital(item.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      <div className="card">
        <div className="section-head">
          <h3>Manage Health Tips</h3>
        </div>
        {tipList.map((item) => (
          <article key={item.id} className="manage-row">
            <div>
              <strong>{item.title}</strong>
              <p>{item.category}</p>
              <p>{item.description}</p>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn secondary-btn"
                onClick={() => {
                  setTip({ title: item.title, description: item.description, category: item.category });
                  setEditingTipId(item.id);
                }}
              >
                Edit
              </button>
              <button type="button" className="btn" onClick={() => handleDeleteTip(item.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AdminPage;
