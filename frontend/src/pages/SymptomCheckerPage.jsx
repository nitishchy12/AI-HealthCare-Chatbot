import { useState } from 'react';
import { runSymptomCheck } from '../services/health.service';

const symptomOptions = ['Fever', 'Cough', 'Headache', 'Stomach pain', 'Vomiting', 'Body pain', 'Chest pain'];

function SymptomCheckerPage() {
  const [symptoms, setSymptoms] = useState([]);
  const [form, setForm] = useState({ feverDays: 0, breathingDifficulty: false, chestPain: false, fatigueLevel: 'Low' });
  const [result, setResult] = useState(null);

  const toggleSymptom = (symptom) => {
    setSymptoms((prev) => (prev.includes(symptom) ? prev.filter((item) => item !== symptom) : [...prev, symptom]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await runSymptomCheck({ symptoms, ...form, feverDays: Number(form.feverDays) });
    setResult(res.data);
  };

  return (
    <section className="page two-column-page">
      <div className="card">
        <p className="eyebrow">Guided Triage</p>
        <h2>Symptom Checker</h2>
        <form onSubmit={handleSubmit} className="form">
          <div className="chip-grid">
            {symptomOptions.map((symptom) => (
              <button
                key={symptom}
                type="button"
                className={`chip ${symptoms.includes(symptom) ? 'chip-active' : ''}`}
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            max="30"
            value={form.feverDays}
            onChange={(e) => setForm({ ...form, feverDays: e.target.value })}
            placeholder="How many days have you had fever?"
          />
          <label className="toggle-row">
            <input type="checkbox" checked={form.breathingDifficulty} onChange={(e) => setForm({ ...form, breathingDifficulty: e.target.checked })} />
            <span>Breathing difficulty</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={form.chestPain} onChange={(e) => setForm({ ...form, chestPain: e.target.checked })} />
            <span>Chest pain</span>
          </label>
          <select value={form.fatigueLevel} onChange={(e) => setForm({ ...form, fatigueLevel: e.target.value })}>
            <option value="Low">Low fatigue</option>
            <option value="Medium">Medium fatigue</option>
            <option value="High">High fatigue</option>
          </select>
          <button className="btn" type="submit" disabled={symptoms.length === 0}>Analyze Symptoms</button>
        </form>
      </div>

      <div className="card">
        <p className="eyebrow">Assessment Result</p>
        {!result && <p>Select symptoms and answer follow-up questions to generate a triage result.</p>}
        {result && (
          <>
            {result.emergency && <div className="emergency-banner">Emergency risk detected. Visit the nearest hospital immediately.</div>}
            <h3>{result.possibleDisease}</h3>
            <p><strong>Risk Score:</strong> {result.riskScore}/10</p>
            <p><strong>Risk Level:</strong> <span className={`pill ${result.riskLevel.toLowerCase()}`}>{result.riskLevel}</span></p>
            <h4>Recommendations</h4>
            {result.recommendations.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export default SymptomCheckerPage;
