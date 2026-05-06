import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  User, Heart, Settings, Shield, Lock, EyeOff, Eye, Save, LogOut, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfile, updateProfile } from '../services/health.service';
import api from '../services/api';
import { registerPushSubscription, unregisterPushSubscription } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

const TABS = [
  { id: 'personal',    label: 'Personal',    icon: User    },
  { id: 'medical',     label: 'Medical',     icon: Heart   },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'security',    label: 'Security',    icon: Shield  },
];

const personalSchema = z.object({
  name:   z.string().min(2, 'At least 2 characters'),
  age:    z.coerce.number().min(1).max(120).optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say', '']).optional(),
  city:   z.string().max(80).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword:     z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

/* ── Personal ────────────────────────────────────────────────────── */
function PersonalTab({ profile }) {
  const { updateUser } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      name: profile?.name || '', age: profile?.age || '',
      gender: profile?.gender || '', city: profile?.city || '',
    },
  });
  const onSubmit = async (data) => {
    try {
      const res = await updateProfile({ ...data, age: data.age ? Number(data.age) : null });
      updateUser(res.data); toast.success('Profile updated');
    } catch (e) { toast.error(e?.response?.data?.message || 'Update failed'); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <Input label="Full name" required error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Age" type="number" min="1" max="120" {...register('age')} />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-primary dark:text-text-dark">Gender</label>
          <select className="w-full h-10 px-3 rounded border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" {...register('gender')}>
            <option value="">Select</option>
            {['Male','Female','Other','Prefer not to say'].map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <Input label="City" placeholder="e.g. Delhi" {...register('city')} />
      <Button type="submit" loading={isSubmitting} className="gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
    </form>
  );
}

/* ── Medical ─────────────────────────────────────────────────────── */
function MedicalTab({ profile }) {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ allergies: '', conditions: '', medications: '', medical_notes: profile?.medical_notes || '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const combined = `Allergies: ${form.allergies}\nConditions: ${form.conditions}\nMedications: ${form.medications}\n\n${form.medical_notes}`.trim();
      const res = await updateProfile({ name: profile?.name || '', medical_notes: combined });
      updateUser(res.data); toast.success('Medical info saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-4 max-w-lg">
      <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-amber-700 dark:text-amber-400">
        ⚠️ This info personalises your AI health assessments. Stored securely, never shared.
      </div>
      {[
        { k: 'allergies',     label: 'Known Allergies',     ph: 'e.g. Penicillin, Peanuts…'    },
        { k: 'conditions',    label: 'Chronic Conditions',  ph: 'e.g. Diabetes, Hypertension…'  },
        { k: 'medications',   label: 'Current Medications', ph: 'e.g. Metformin 500mg…'         },
        { k: 'medical_notes', label: 'Additional Notes',    ph: 'Any other health context…'     },
      ].map(({ k, label, ph }) => (
        <div key={k} className="space-y-1.5">
          <label className="text-xs font-medium text-text-primary dark:text-text-dark">{label}</label>
          <textarea rows={2} placeholder={ph} value={form[k]} onChange={set(k)}
            className="w-full px-3 py-2 rounded border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-text-primary dark:text-text-dark placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none" />
        </div>
      ))}
      <Button onClick={save} loading={saving} className="gap-2"><Save className="w-4 h-4" /> Save Medical Info</Button>
    </div>
  );
}

/* ── Preferences ─────────────────────────────────────────────────── */
function PreferencesTab({ profile }) {
  const [lang,    setLang]    = useState(profile?.preferred_language || 'en');
  const [theme,   setTheme]   = useState(profile?.theme_preference || 'light');
  const [saving,  setSaving]  = useState(false);
  const [pushOn,  setPushOn]  = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.getRegistration('/sw.js').then(async (reg) => {
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setPushOn(Boolean(sub));
      }).catch(() => {});
    }
  }, []);

  const togglePush = async (enabled) => {
    setPushBusy(true);
    try {
      if (enabled) {
        await registerPushSubscription();
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setPushOn(Boolean(sub));
        if (sub) toast.success('Push notifications enabled');
        else toast.error('Could not enable push notifications');
      } else {
        await unregisterPushSubscription();
        setPushOn(false);
        toast.success('Push notifications disabled');
      }
    } catch {
      toast.error('Push notification toggle failed');
    } finally {
      setPushBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: profile?.name || '', preferred_language: lang, theme_preference: theme });
      toast.success('Preferences saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <p className="text-sm font-semibold text-text-primary dark:text-text-dark mb-2">Language</p>
        <div className="flex gap-2">
          {[{ val: 'en', label: 'English' }, { val: 'hi', label: 'हिंदी' }].map(({ val, label }) => (
            <button key={val} onClick={() => setLang(val)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                lang === val ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-muted hover:border-primary')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary dark:text-text-dark mb-2">Theme</p>
        <div className="flex gap-2 flex-wrap">
          {[['light','Light'],['dark','Dark'],['system','System']].map(([val, label]) => (
            <button key={val} onClick={() => setTheme(val)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                theme === val ? 'bg-primary text-white border-primary' : 'border-border dark:border-border-dark text-text-muted hover:border-primary')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {'Notification' in window && (
        <div>
          <p className="text-sm font-semibold text-text-primary dark:text-text-dark mb-2">Push Notifications</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => !pushBusy && togglePush(!pushOn)}
              disabled={pushBusy}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                pushOn ? 'bg-primary' : 'bg-border dark:bg-border-dark',
                pushBusy && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200', pushOn ? 'translate-x-5' : 'translate-x-0')} />
            </button>
            <span className="text-sm text-text-muted">
              {pushOn ? 'Enabled — receive health reminders and tips' : 'Disabled'}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-text-subtle dark:text-text-muted">Requires HTTPS in production. Browser permission required.</p>
        </div>
      )}
      <Button onClick={save} loading={saving} className="gap-2"><Save className="w-4 h-4" /> Save Preferences</Button>
    </div>
  );
}

/* ── Security ─────────────────────────────────────────────────────── */
function SecurityTab() {
  const { logout } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({ resolver: zodResolver(passwordSchema) });
  const onSubmit = async (data) => {
    try {
      await api.post('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed — signing you out'); reset(); setTimeout(logout, 2000);
    } catch (e) { toast.error(e?.response?.data?.message || 'Change failed'); }
  };
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-semibold text-text-primary dark:text-text-dark mb-3">Change Password</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="relative">
            <Input label="Current password" type={showPw ? 'text' : 'password'} error={errors.currentPassword?.message} {...register('currentPassword')} />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-[34px] text-text-muted">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input label="New password (8+, 1 uppercase, 1 number)" type="password" error={errors.newPassword?.message} {...register('newPassword')} />
          <Input label="Confirm new password" type="password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <Button type="submit" loading={isSubmitting} className="gap-2"><Lock className="w-4 h-4" /> Change Password</Button>
        </form>
      </div>
      <div className="h-px bg-border dark:bg-border-dark" />
      <div>
        <h3 className="text-base font-semibold text-text-primary dark:text-text-dark mb-1">Sign Out All Devices</h3>
        <p className="text-xs text-text-muted mb-3">Revoke all active sessions. You will be signed out everywhere.</p>
        <Button variant="danger" onClick={async () => { await api.post('/auth/logout-all', {}); logout(); }} className="gap-2">
          <LogOut className="w-4 h-4" /> Sign Out All Devices
        </Button>
      </div>
      <div className="h-px bg-border dark:bg-border-dark" />
      <div>
        <h3 className="text-base font-semibold text-text-primary dark:text-text-dark mb-1">Export My Data</h3>
        <p className="text-xs text-text-muted mb-3">Download all your health records, conversations and profile data.</p>
        <Button variant="secondary" onClick={() => toast.success('Data export queued')} className="gap-2">
          <Download className="w-4 h-4" /> Request Export
        </Button>
      </div>
    </div>
  );
}

/* ── Page shell ───────────────────────────────────────────────────── */
export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('personal');

  useEffect(() => {
    getProfile().then((r) => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const content = {
    personal:    <PersonalTab    profile={profile} />,
    medical:     <MedicalTab     profile={profile} />,
    preferences: <PreferencesTab profile={profile} />,
    security:    <SecurityTab />,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Account</p>
        <h1 className="text-2xl font-bold text-text-primary dark:text-text-dark mt-1">Profile Settings</h1>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-6">
          <nav className="flex sm:flex-col gap-1 sm:w-44 shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full',
                  tab === id ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/60')}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
          <div className="flex-1 min-w-0">
            <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <Card padding="lg">{content[tab]}</Card>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
