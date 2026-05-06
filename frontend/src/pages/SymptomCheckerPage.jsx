import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, MessageSquare, Save, Search, ShieldCheck, User, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  addConversationSystemMessage,
  createConversation,
  getHospitalsByCity,
  getProfile,
  runSymptomCheck,
} from '../services/health.service';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import RiskBadge from '../components/ui/RiskBadge';
import Spinner from '../components/ui/Spinner';
import { cn } from '../lib/cn';

const PRIMARY_SYMPTOMS = [
  'Fever', 'Cough', 'Headache', 'Stomach pain', 'Vomiting', 'Body pain',
  'Chest pain', 'Shortness of breath', 'Fatigue', 'Dizziness', 'Sore throat',
  'Runny nose', 'Nausea', 'Back pain', 'Joint pain', 'Skin rash', 'Eye pain',
  'Ear pain', 'Loss of appetite', 'Sweating',
];

const STEPS = [
  'Primary Symptoms',
  'Duration & Severity',
  'Associated Symptoms',
  'Health Profile',
  'Result',
];

const DURATIONS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: '2-3-days', label: '2-3 days', days: 2 },
  { value: '4-7-days', label: '4-7 days', days: 4 },
  { value: '1-2-weeks', label: '1-2 weeks', days: 7 },
  { value: 'longer', label: 'Longer', days: 14 },
];

const stepMotion = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.18 },
};

const riskColor = {
  Low: 'text-green-700 dark:text-green-400',
  Medium: 'text-amber-700 dark:text-amber-400',
  High: 'text-red-700 dark:text-red-400',
};

function StepProgress({ step }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-3">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center">
            <div
              className={cn(
                'h-3 w-3 rounded-full transition-colors',
                index < step && 'bg-teal-800',
                index === step && 'bg-primary ring-4 ring-primary/15',
                index > step && 'bg-slate-300 dark:bg-slate-700',
              )}
              aria-label={label}
            />
            {index < STEPS.length - 1 && (
              <div className={cn('mx-2 h-0.5 w-8 sm:w-14', index < step ? 'bg-teal-800' : 'bg-slate-300 dark:bg-slate-700')} />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm font-medium text-text-muted">{STEPS[step]}</p>
    </div>
  );
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-white text-text-muted hover:border-primary hover:text-primary dark:border-border-dark dark:bg-surface-dark',
      )}
    >
      {label}
    </button>
  );
}

const normalizeResult = (result) => ({
  riskLevel: result?.riskLevel || result?.risk_level || 'Low',
  reasoning: result?.riskReasoning || result?.risk_reasoning || '',
  actions: result?.recommendations || result?.recommended_actions || [],
  specialists: result?.specialistsSuggested || result?.specialists_suggested || ['General Physician'],
  disease: result?.possibleDisease || 'General health concern',
  score: result?.riskScore || 0,
  emergency: Boolean(result?.emergency),
  disclaimer: result?.disclaimer || 'This assessment is for health awareness only and is not a medical diagnosis. Always consult a qualified healthcare professional.',
});

export default function SymptomCheckerPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [savedHint, setSavedHint] = useState('');

  const [primarySymptoms, setPrimarySymptoms] = useState([]);
  const [query, setQuery] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');

  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState(5);

  const [relatedOptions, setRelatedOptions] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [associatedSymptoms, setAssociatedSymptoms] = useState([]);
  const [noneRelated, setNoneRelated] = useState(false);

  const [profile, setProfile] = useState({ age: '', gender: '', city: '', medical_notes: '' });
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    let mounted = true;
    getProfile()
      .then((response) => {
        if (!mounted) return;
        const data = response.data || {};
        setProfile({
          age: data.age || '',
          gender: data.gender || '',
          city: data.city || '',
          medical_notes: data.medical_notes || '',
        });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    setRelatedLoading(true);
    api.post('/symptoms/related', {
      primary_symptoms: primarySymptoms,
      duration,
      severity,
    })
      .then((response) => setRelatedOptions(response.data?.data || []))
      .catch(() => setRelatedOptions([]))
      .finally(() => setRelatedLoading(false));
  }, [step, primarySymptoms, duration, severity]);

  const visibleSymptoms = useMemo(
    () => PRIMARY_SYMPTOMS.filter((symptom) => symptom.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const allSymptoms = useMemo(() => {
    const other = otherText.trim();
    return [...primarySymptoms, ...associatedSymptoms, ...(other ? [other] : [])];
  }, [primarySymptoms, associatedSymptoms, otherText]);

  const durationMeta = DURATIONS.find((item) => item.value === duration);

  const canProceed = () => {
    if (step === 0) return primarySymptoms.length > 0 || otherText.trim().length > 1;
    if (step === 1) return Boolean(duration) && severity >= 1;
    return true;
  };

  const togglePrimary = (symptom) => {
    setPrimarySymptoms((current) => (
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    ));
  };

  const toggleAssociated = (symptom) => {
    setNoneRelated(false);
    setAssociatedSymptoms((current) => (
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    ));
  };

  const submitCheck = async () => {
    setSubmitting(true);
    setSavedHint('');
    try {
      const payload = {
        symptoms: allSymptoms,
        feverDays: durationMeta?.days ?? 0,
        breathingDifficulty: allSymptoms.some((symptom) => symptom.toLowerCase() === 'shortness of breath'),
        chestPain: allSymptoms.some((symptom) => symptom.toLowerCase() === 'chest pain'),
        fatigueLevel: severity >= 8 ? 'High' : severity >= 5 ? 'Medium' : 'Low',
        profile,
      };

      const response = await runSymptomCheck(payload);
      const rawResult = response.data;
      const normalized = normalizeResult(rawResult);
      setResult(rawResult);

      if (['Medium', 'High'].includes(normalized.riskLevel)) {
        localStorage.setItem('last_symptom_result', JSON.stringify({
          specialist: normalized.specialists[0] || 'General Physician',
          risk: normalized.riskLevel,
          timestamp: Date.now(),
        }));
      }

      if (profile.city) {
        const hospitalResponse = await getHospitalsByCity(profile.city, normalized.specialists[0] || '');
        setHospitals((hospitalResponse.data || []).slice(0, 3));
      } else {
        setHospitals([]);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    if (!canProceed()) return;
    if (step === 3) {
      setStep(4);
      await submitCheck();
      return;
    }
    setStep((current) => Math.min(current + 1, 4));
  };

  const back = () => setStep((current) => Math.max(current - 1, 0));

  const resultView = normalizeResult(result);

  const summaryForChat = () => [
    'Symptom check summary for this conversation:',
    `Symptoms: ${allSymptoms.join(', ') || 'Not provided'}`,
    `Duration: ${durationMeta?.label || 'Not provided'}`,
    `Severity: ${severity}/10`,
    `Risk level: ${resultView.riskLevel}`,
    `Reasoning: ${resultView.reasoning}`,
    `Recommended actions: ${resultView.actions.join('; ')}`,
    `Suggested specialists: ${resultView.specialists.join(', ')}`,
  ].join('\n');

  const continueInChat = async () => {
    try {
      const title = `Symptom check - ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      const conversation = await createConversation({ firstMessage: title, language: 'en' });
      const conversationId = conversation.data?._id;
      if (conversationId) {
        await addConversationSystemMessage(conversationId, summaryForChat());
        localStorage.setItem('last_conversation_id', conversationId);
      }
      navigate('/chat');
    } catch {
      toast.error('Could not open chat. Please navigate to Chat manually.');
      navigate('/chat');
    }
  };

  const saveToHistory = () => {
    setSavedHint('Saved to your health history.');
    toast.success('Symptom check saved to history');
  };

  const restart = () => {
    setStep(0);
    setResult(null);
    setHospitals([]);
    setSavedHint('');
    setPrimarySymptoms([]);
    setAssociatedSymptoms([]);
    setNoneRelated(false);
    setOtherText('');
    setOtherOpen(false);
    setDuration('');
    setSeverity(5);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background px-4 py-8 dark:bg-background-dark">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guided Triage</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary dark:text-text-dark">Symptom Checker</h1>
        </div>

        <StepProgress step={step} />

        <AnimatePresence mode="wait">
          <motion.div key={step} {...stepMotion}>
            {step === 0 && (
              <Card padding="lg" className="space-y-4">
                <h2 className="text-base font-semibold text-text-primary dark:text-text-dark">Select your primary symptoms</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search symptoms"
                    className="h-10 w-full rounded border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleSymptoms.map((symptom) => (
                    <Chip key={symptom} label={symptom} selected={primarySymptoms.includes(symptom)} onClick={() => togglePrimary(symptom)} />
                  ))}
                  <Chip label="Other" selected={otherOpen || otherText.trim().length > 0} onClick={() => setOtherOpen(true)} />
                </div>
                {otherOpen && (
                  <div className="flex gap-2">
                    <input
                      value={otherText}
                      onChange={(event) => setOtherText(event.target.value)}
                      placeholder="Describe other symptom"
                      className="h-10 flex-1 rounded border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark"
                    />
                    <Button variant="ghost" size="sm" onClick={() => { setOtherText(''); setOtherOpen(false); }} aria-label="Clear other symptom">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {visibleSymptoms.length === 0 && <p className="text-sm text-text-muted">No symptoms match your search.</p>}
              </Card>
            )}

            {step === 1 && (
              <Card padding="lg" className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-text-primary dark:text-text-dark">Duration</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DURATIONS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setDuration(item.value)}
                        className={cn(
                          'rounded border px-4 py-2 text-sm font-medium transition-colors',
                          duration === item.value
                            ? 'border-primary bg-primary text-white'
                            : 'border-border text-text-muted hover:border-primary dark:border-border-dark',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-text-primary dark:text-text-dark">Severity</span>
                    <span className={cn('font-bold', severity >= 8 ? riskColor.High : severity >= 5 ? riskColor.Medium : riskColor.Low)}>
                      {severity}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={severity}
                    onChange={(event) => setSeverity(Number(event.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="mt-1 flex justify-between text-xs text-text-muted">
                    <span>1 = Mild</span>
                    <span>5 = Moderate</span>
                    <span>10 = Severe</span>
                  </div>
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card padding="lg" className="space-y-4">
                <h2 className="text-base font-semibold text-text-primary dark:text-text-dark">Associated symptoms</h2>
                {relatedLoading ? (
                  <div className="flex items-center justify-center py-8"><Spinner size="md" className="text-primary" /></div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {relatedOptions.map((symptom) => (
                      <Chip key={symptom} label={symptom} selected={associatedSymptoms.includes(symptom)} onClick={() => toggleAssociated(symptom)} />
                    ))}
                    <Chip
                      label="None of these"
                      selected={noneRelated}
                      onClick={() => {
                        setAssociatedSymptoms([]);
                        setNoneRelated(true);
                      }}
                    />
                  </div>
                )}
              </Card>
            )}

            {step === 3 && (
              <Card padding="lg" className="space-y-4">
                <h2 className="text-base font-semibold text-text-primary dark:text-text-dark">Health profile snapshot</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium text-text-muted">
                    Age
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={profile.age}
                      onChange={(event) => setProfile((current) => ({ ...current, age: event.target.value }))}
                      className="h-10 w-full rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-text-muted">
                    Gender
                    <select
                      value={profile.gender}
                      onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))}
                      className="h-10 w-full rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                    >
                      <option value="">Not specified</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                      <option>Prefer not to say</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-text-muted">
                    City
                    <input
                      value={profile.city}
                      onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))}
                      placeholder="e.g. Phagwara"
                      className="h-10 w-full rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                    />
                  </label>
                </div>
                <label className="block space-y-1 text-xs font-medium text-text-muted">
                  Medical notes
                  <textarea
                    rows={3}
                    value={profile.medical_notes}
                    onChange={(event) => setProfile((current) => ({ ...current, medical_notes: event.target.value }))}
                    className="w-full resize-none rounded border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                  />
                </label>
              </Card>
            )}

            {step === 4 && (
              <div className="space-y-4">
                {submitting && (
                  <Card padding="lg" className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Activity className="h-7 w-7 animate-pulse text-primary" />
                    </div>
                    <p className="font-semibold text-text-primary dark:text-text-dark">Analysing your symptoms...</p>
                  </Card>
                )}

                {!submitting && result && (
                  <>
                    {resultView.emergency && (
                      <div className="flex gap-3 rounded-lg bg-danger p-4 text-white">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                          <p className="font-bold">Emergency warning signs detected</p>
                          <p className="text-sm opacity-90">Please seek urgent medical care immediately.</p>
                        </div>
                      </div>
                    )}
                    <Card padding="lg" className="space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Assessment Result</p>
                          <h2 className="mt-1 text-xl font-bold text-text-primary dark:text-text-dark">{resultView.disease}</h2>
                        </div>
                        <RiskBadge level={resultView.riskLevel} />
                      </div>
                      <p className="text-sm leading-6 text-text-muted">{resultView.reasoning}</p>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Recommended actions</p>
                        <ul className="space-y-2">
                          {resultView.actions.map((action) => (
                            <li key={action} className="flex gap-2 text-sm text-text-primary dark:text-text-dark">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Suggested specialists</p>
                        <div className="flex flex-wrap gap-2">
                          {resultView.specialists.map((specialist) => (
                            <span key={specialist} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{specialist}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Nearest hospitals</p>
                        {hospitals.length === 0 ? (
                          <p className="rounded border border-dashed border-border p-3 text-sm text-text-muted dark:border-border-dark">No nearby hospital suggestions found for your city.</p>
                        ) : (
                          <div className="grid gap-2">
                            {hospitals.map((hospital) => (
                              <div key={hospital.id} className="flex items-center justify-between rounded border border-border p-3 text-sm dark:border-border-dark">
                                <div>
                                  <p className="font-semibold text-text-primary dark:text-text-dark">{hospital.name}</p>
                                  <p className="text-xs text-text-muted">{hospital.city} - {hospital.specialization || hospital.specialties?.[0] || 'General'}</p>
                                </div>
                                {hospital.phone && <a href={`tel:${hospital.phone}`} className="text-xs font-semibold text-primary">Call</a>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="rounded bg-slate-50 p-3 text-xs text-text-muted dark:bg-slate-900/40">{resultView.disclaimer}</p>
                    </Card>
                    {savedHint && <p className="text-center text-sm font-medium text-success">{savedHint}</p>}
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex flex-wrap gap-3">
          {step > 0 && step < 4 && (
            <Button variant="secondary" onClick={back} className="flex-1 gap-2">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step < 3 && (
            <Button disabled={!canProceed()} onClick={next} className="flex-1 gap-2">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <>
              <Button variant="secondary" onClick={back} className="flex-1 gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={next} className="flex-1 gap-2">
                Get Assessment <ShieldCheck className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === 4 && !submitting && result && (
            <>
              <Button variant="secondary" onClick={restart} className="flex-1">Start Over</Button>
              <Button variant="secondary" onClick={saveToHistory} className="flex-1 gap-2">
                <Save className="h-4 w-4" /> Save to History
              </Button>
              <Button onClick={continueInChat} className="flex-1 gap-2">
                <MessageSquare className="h-4 w-4" /> Continue in Chat
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
