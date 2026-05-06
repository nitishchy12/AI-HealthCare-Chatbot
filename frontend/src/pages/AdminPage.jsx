import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Hospital, Stethoscope, Lightbulb, ScrollText,
  Plus, Pencil, Trash2, Save, X, Users, AlertTriangle,
  Bot, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  addDisease, addHealthTip, addHospital,
  deleteDisease, deleteHealthTip, deleteHospital,
  getDiseases, getHealthTips, getHospitalsByCity,
  updateDisease, updateHealthTip, updateHospital,
} from '../services/health.service';
import api from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

/* ── Sidebar tabs ──────────────────────────────────────────────── */
const TABS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'users',     label: 'Users', icon: Users },
  { id: 'hospitals', label: 'Hospitals',  icon: Hospital },
  { id: 'diseases',  label: 'Diseases',   icon: Stethoscope },
  { id: 'tips',      label: 'Tips', icon: Lightbulb },
  { id: 'ai',        label: 'AI Settings', icon: Bot },
  { id: 'audit',     label: 'Audit Log',  icon: ClipboardList },
];

/* ── Inline form field ─────────────────────────────────────────── */
function Field({ label, value, onChange, type = 'text', placeholder, required, as }) {
  const cls = 'w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors';
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-primary dark:text-text-dark">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {as === 'textarea'
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cn(cls, 'resize-none')} />
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(cls, 'h-9')} />}
    </div>
  );
}

/* ── Dashboard stats ────────────────────────────────────────────── */
function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => setStats(res.data?.data || null))
      .catch(() => setStats(null));
  }, []);

  const cards = [
    { label: 'Total users', value: stats?.total_users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Active 24h', value: stats?.active_24h, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Conversations 7d', value: stats?.conversations_7d, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'High risk 7d', value: stats?.high_risk_7d, color: 'text-danger', bg: 'bg-danger/10' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-text-primary dark:text-text-dark">Admin Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {cards.map(({ label, value, color, bg }) => (
          <Card key={label} padding="md" className="flex items-center gap-4">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', bg)}>
              <span className={cn('text-2xl font-bold', color)}>{value ?? '–'}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary dark:text-text-dark">{label}</p>
              <p className="text-xs text-text-muted">system metric</p>
            </div>
          </Card>
        ))}
      </div>
      <Card padding="md" className="flex items-start gap-3 bg-warning/5 border-warning/30">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Admin access</p>
          <p className="text-xs text-text-muted mt-0.5">You have full CRUD access to hospital, disease, and health tip data. All actions are audit-logged.</p>
        </div>
      </Card>
    </div>
  );
}

/* ── Generic CRUD table ─────────────────────────────────────────── */
function CrudTable({ title, columns, rows, loading, onAdd, onEdit, onDelete, renderForm, addLabel }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary dark:text-text-dark">{title}</h2>
        <Button size="sm" onClick={onAdd} className="gap-2">
          <Plus className="w-4 h-4" /> {addLabel || 'Add'}
        </Button>
      </div>
      {renderForm && <Card padding="md">{renderForm()}</Card>}
      <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-background dark:bg-background-dark border-b border-border dark:border-border-dark">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider">{c.label}</th>
              ))}
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-6">
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
              </td></tr>
            )}
            {!loading && rows.map((row, i) => (
              <tr key={row.id || i} className="border-b border-border/50 dark:border-border-dark/50 hover:bg-background dark:hover:bg-background-dark transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-text-primary dark:text-text-dark">
                    {c.render ? c.render(row[c.key], row) : (String(row[c.key] || '–').slice(0, 60))}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => onEdit(row)} className="p-1.5 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(row)} className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-sm text-text-muted">No records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Hospitals section ──────────────────────────────────────────── */
function HospitalsAdmin() {
  const blank = { name: '', city: '', address: '', phone: '', specialization: 'General Physician', latitude: '', longitude: '', rating: 4.2 };
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    getHospitalsByCity('', '').then((r) => setRows(r.data || [])).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) { await updateHospital(form.id, form); toast.success('Hospital updated'); }
      else          { await addHospital(form);             toast.success('Hospital added'); }
      const r = await getHospitalsByCity('', ''); setRows(r.data || []); setForm(null);
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!confirm(`Delete ${row.name}?`)) return;
    try { await deleteHospital(row.id); setRows((prev) => prev.filter((r) => r.id !== row.id)); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <CrudTable
      title="Hospitals"
      loading={loading}
      rows={rows}
      columns={[
        { key: 'name',           label: 'Name' },
        { key: 'city',           label: 'City' },
        { key: 'specialization', label: 'Specialization' },
        { key: 'rating',         label: 'Rating', render: (v) => `⭐ ${Number(v || 0).toFixed(1)}` },
      ]}
      onAdd={() => setForm(blank)}
      onEdit={(row) => setForm({ ...row })}
      onDelete={remove}
      addLabel="Add Hospital"
      renderForm={form ? () => (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark">{form.id ? 'Edit' : 'Add'} Hospital</h3>
            <button onClick={() => setForm(null)} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={form.name} onChange={set('name')} required />
            <Field label="City" value={form.city} onChange={set('city')} required />
            <Field label="Address" value={form.address} onChange={set('address')} required />
            <Field label="Phone" value={form.phone} onChange={set('phone')} />
            <Field label="Specialization" value={form.specialization} onChange={set('specialization')} />
            <Field label="Rating (1–5)" value={form.rating} onChange={set('rating')} type="number" />
            <Field label="Latitude" value={form.latitude} onChange={set('latitude')} />
            <Field label="Longitude" value={form.longitude} onChange={set('longitude')} />
          </div>
          <Button size="sm" onClick={save} loading={saving} className="gap-2">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      ) : null}
    />
  );
}

/* ── Diseases section ───────────────────────────────────────────── */
function DiseasesAdmin() {
  const blank = { disease_name: '', symptoms: '', prevention: '', treatment: '', risk_factors: '' };
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { getDiseases().then((r) => setRows(r.data || [])).finally(() => setLoading(false)); }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) { await updateDisease(form.id, form); toast.success('Disease updated'); }
      else          { await addDisease(form);             toast.success('Disease added'); }
      const r = await getDiseases(); setRows(r.data || []); setForm(null);
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!confirm(`Delete "${row.disease_name}"?`)) return;
    try { await deleteDisease(row.id); setRows((prev) => prev.filter((r) => r.id !== row.id)); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <CrudTable
      title="Diseases"
      loading={loading}
      rows={rows.map((r) => ({ ...r, id: r.id }))}
      columns={[
        { key: 'disease_name', label: 'Disease' },
        { key: 'symptoms',     label: 'Symptoms', render: (v) => String(v || '').slice(0, 50) + (String(v || '').length > 50 ? '…' : '') },
        { key: 'risk_factors', label: 'Risk Factors', render: (v) => String(v || '').slice(0, 40) + (String(v || '').length > 40 ? '…' : '') },
      ]}
      onAdd={() => setForm(blank)}
      onEdit={(row) => setForm({ ...row })}
      onDelete={remove}
      addLabel="Add Disease"
      renderForm={form ? () => (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">{form.id ? 'Edit' : 'Add'} Disease</h3>
            <button onClick={() => setForm(null)}><X className="w-4 h-4 text-text-muted" /></button>
          </div>
          <Field label="Disease Name" value={form.disease_name} onChange={set('disease_name')} required />
          <Field label="Symptoms (comma-separated)" value={form.symptoms} onChange={set('symptoms')} as="textarea" />
          <Field label="Prevention" value={form.prevention} onChange={set('prevention')} as="textarea" />
          <Field label="Treatment" value={form.treatment} onChange={set('treatment')} as="textarea" />
          <Field label="Risk Factors" value={form.risk_factors} onChange={set('risk_factors')} as="textarea" />
          <Button size="sm" onClick={save} loading={saving} className="gap-2">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      ) : null}
    />
  );
}

/* ── Tips section ───────────────────────────────────────────────── */
function TipsAdmin() {
  const blank = { title: '', description: '', category: 'General Wellness', scheduled_at: '' };
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { getHealthTips().then((r) => setRows(r.data || [])).finally(() => setLoading(false)); }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) { await updateHealthTip(form.id, form); toast.success('Tip updated'); }
      else          { await addHealthTip(form);             toast.success('Tip added'); }
      const r = await getHealthTips(); setRows(r.data || []); setForm(null);
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    try { await deleteHealthTip(row.id); setRows((prev) => prev.filter((r) => r.id !== row.id)); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <CrudTable
      title="Health Tips"
      loading={loading}
      rows={rows}
      columns={[
        { key: 'title',       label: 'Title' },
        { key: 'category',    label: 'Category' },
        { key: 'description', label: 'Description', render: (v) => String(v || '').slice(0, 60) + '…' },
      ]}
      onAdd={() => setForm(blank)}
      onEdit={(row) => setForm({ ...row })}
      onDelete={remove}
      addLabel="Add Tip"
      renderForm={form ? () => (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">{form.id ? 'Edit' : 'Add'} Health Tip</h3>
            <button onClick={() => setForm(null)}><X className="w-4 h-4 text-text-muted" /></button>
          </div>
          <Field label="Title" value={form.title} onChange={set('title')} required />
          <Field label="Category" value={form.category} onChange={set('category')} placeholder="e.g. Nutrition, Sleep, Exercise" />
          <Field label="Scheduled At" value={form.scheduled_at || ''} onChange={set('scheduled_at')} type="datetime-local" />
          <Field label="Description" value={form.description} onChange={set('description')} as="textarea" required />
          <Button size="sm" onClick={save} loading={saving} className="gap-2">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      ) : null}
    />
  );
}

/* ── Audit Log ──────────────────────────────────────────────────── */
function UsersAdmin() {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users?search=${encodeURIComponent(search)}&role=${encodeURIComponent(role)}&page=1`)
      .then((res) => setUsersList(res.data?.data || []))
      .catch(() => toast.error('Could not load users'))
      .finally(() => setLoading(false));
  }, [search, role]);

  useEffect(() => {
    const id = setTimeout(load, 400);
    return () => clearTimeout(id);
  }, [load]);

  const changeRole = async (userId, nextRole) => {
    await api.patch(`/admin/users/${userId}/role`, { role: nextRole });
    toast.success('Role updated');
    load();
  };

  const setSuspended = async (userId, suspended) => {
    await api.patch(`/admin/users/${userId}/suspend`, { suspended });
    toast.success(suspended ? 'User suspended' : 'User unsuspended');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-text-primary dark:text-text-dark">Users</h2>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="h-9 rounded border border-border px-3 text-sm dark:border-border-dark dark:bg-surface-dark" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded border border-border px-3 text-sm dark:border-border-dark dark:bg-surface-dark">
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
        <table className="w-full text-sm">
          <thead><tr className="bg-background dark:bg-background-dark">{['Name', 'Email', 'Role', 'Last Seen', 'Status', 'Actions'].map((label) => <th key={label} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="p-4"><Skeleton className="h-10" /></td></tr>}
            {!loading && usersList.map((user) => (
              <tr key={user.id} className="border-t border-border/60 dark:border-border-dark/60">
                <td className="px-4 py-3 font-medium text-text-primary dark:text-text-dark">{user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'}</td>
                <td className="px-4 py-3 text-text-muted">{user.email}</td>
                <td className="px-4 py-3"><select value={user.role} onChange={(e) => changeRole(user.id, e.target.value)} className="rounded border border-border px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-dark"><option value="user">user</option><option value="admin">admin</option></select></td>
                <td className="px-4 py-3 text-text-muted">{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : '-'}</td>
                <td className="px-4 py-3">{user.is_suspended ? <span className="text-danger">Suspended</span> : <span className="text-success">Active</span>}</td>
                <td className="px-4 py-3"><label className="inline-flex items-center gap-2 text-xs text-text-muted"><input type="checkbox" checked={Boolean(user.is_suspended)} onChange={(e) => setSuspended(user.id, e.target.checked)} />Suspend</label></td>
              </tr>
            ))}
            {!loading && usersList.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-text-muted">No users found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AiSettings() {
  const [prompts,   setPrompts]   = useState([]);
  const [active,    setActive]    = useState('');
  const [evalData,  setEvalData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activating, setActivating] = useState('');
  const [running,   setRunning]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/prompts').catch(() => ({ data: { data: [] } })),
      api.get('/admin/eval/latest').catch(() => ({ data: { data: null } })),
    ]).then(([promptsRes, evalRes]) => {
      setPrompts(promptsRes.data?.data || []);
      setActive(promptsRes.data?.active_version || '');
      setEvalData(evalRes.data?.data || null);
    }).finally(() => setLoading(false));
  }, []);

  const activate = async (version) => {
    setActivating(version);
    try {
      await api.post('/admin/prompts/activate', { version });
      setActive(version);
      toast.success(`Prompt ${version} activated`);
    } catch {
      toast.error('Could not activate prompt');
    } finally {
      setActivating('');
    }
  };

  const runEval = async () => {
    setRunning(true);
    try {
      await api.post('/admin/eval/run');
      toast.success('Evaluation started — results will appear in a few minutes');
    } catch {
      toast.error('Evaluation endpoint unavailable');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-text-primary dark:text-text-dark">AI Settings</h2>

      <Card padding="md">
        <h3 className="mb-3 text-sm font-semibold text-text-primary dark:text-text-dark">Prompt Version Management</h3>
        {loading && <Skeleton className="h-16" />}
        {!loading && prompts.length === 0 && (
          <p className="text-sm text-text-muted">No prompt files found. Add .txt files to ai-service/prompts/.</p>
        )}
        {!loading && prompts.map((p) => (
          <div key={p.version} className="flex items-center justify-between rounded-lg border border-border dark:border-border-dark px-4 py-3 mb-2">
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-text-dark">{p.version}</p>
              <p className="text-xs text-text-muted">{p.filename}</p>
            </div>
            {active === p.version
              ? <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">Active</span>
              : <Button size="sm" variant="secondary" loading={activating === p.version} onClick={() => activate(p.version)}>Activate</Button>}
          </div>
        ))}
      </Card>

      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark">Evaluation Results</h3>
          <Button size="sm" loading={running} onClick={runEval} className="gap-2">Run Evaluation</Button>
        </div>
        {evalData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Accuracy',     value: `${(evalData.accuracy * 100).toFixed(1)}%` },
              { label: 'Precision',    value: `${(evalData.precision * 100).toFixed(1)}%` },
              { label: 'F1 Score',     value: `${(evalData.f1 * 100).toFixed(1)}%` },
              { label: 'Refusal Rate', value: `${(evalData.refusal_rate * 100).toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-background dark:bg-background-dark p-3 text-center">
                <p className="text-xs text-text-muted mb-1">{label}</p>
                <p className="text-lg font-bold text-primary">{value}</p>
              </div>
            ))}
            {evalData.run_at && (
              <p className="col-span-full text-xs text-text-muted mt-2">
                Last run: {new Date(evalData.run_at).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{loading ? 'Loading…' : 'No evaluation results yet. Click Run Evaluation to start.'}</p>
        )}
      </Card>
    </div>
  );
}

function AuditLog() {
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [expanded, setExpanded] = useState(null);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (search) params.set('search', search);
    if (from)   params.set('from', from);
    if (to)     params.set('to', to);
    api.get(`/admin/audit-logs?${params}`)
      .then((res) => {
        setLogs(res.data?.data || []);
        setTotal(res.data?.pagination?.total || 0);
      })
      .catch(() => toast.error('Could not load audit logs'))
      .finally(() => setLoading(false));
  }, [search, from, to, page]);

  useEffect(() => { const id = setTimeout(load, 300); return () => clearTimeout(id); }, [load]);

  const exportCsv = () => {
    const rows = [['Timestamp', 'Actor', 'Action', 'Target Type', 'Target ID']];
    logs.forEach((log) => rows.push([
      new Date(log.created_at).toLocaleString(),
      log.actor_name || log.actor_email || log.user_id,
      log.action, log.entity_type, log.entity_id,
    ]));
    const csv  = rows.map((r) => r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-text-primary dark:text-text-dark">Audit Log</h2>
        <Button size="sm" variant="secondary" onClick={exportCsv} className="gap-2">Export CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search actor or action…" className="h-9 rounded border border-border px-3 text-sm flex-1 min-w-[160px] dark:border-border-dark dark:bg-surface-dark dark:text-text-dark" />
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 rounded border border-border px-3 text-sm dark:border-border-dark dark:bg-surface-dark dark:text-text-dark" />
        <input type="date" value={to}   onChange={(e) => { setTo(e.target.value);   setPage(1); }} className="h-9 rounded border border-border px-3 text-sm dark:border-border-dark dark:bg-surface-dark dark:text-text-dark" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-background dark:bg-background-dark">
              {['Timestamp', 'Actor', 'Action', 'Target', 'ID'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="p-4"><Skeleton className="h-10" /></td></tr>}
            {!loading && logs.map((log) => (
              <>
                <tr
                  key={log.id}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  className="border-t border-border/60 dark:border-border-dark/60 cursor-pointer hover:bg-background dark:hover:bg-background-dark"
                >
                  <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-text-primary dark:text-text-dark">{log.actor_name || log.actor_email || `User #${log.user_id}`}</td>
                  <td className="px-4 py-2.5"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{log.action}</span></td>
                  <td className="px-4 py-2.5 text-text-muted">{log.entity_type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{String(log.entity_id).slice(0, 12)}</td>
                </tr>
                {expanded === log.id && log.details && (
                  <tr key={`${log.id}-detail`} className="bg-background/50 dark:bg-background-dark/50">
                    <td colSpan="5" className="px-6 py-3">
                      <pre className="text-xs text-text-muted whitespace-pre-wrap break-all">{JSON.stringify(log.details, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!loading && logs.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-text-muted">No audit entries found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Admin Page ─────────────────────────────────────────────── */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const content = {
    dashboard: <Dashboard />,
    users:     <UsersAdmin />,
    hospitals: <HospitalsAdmin />,
    diseases:  <DiseasesAdmin />,
    tips:      <TipsAdmin />,
    ai:        <AiSettings />,
    audit:     <AuditLog />,
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-background dark:bg-background-dark overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-border dark:border-border-dark bg-white dark:bg-surface-dark flex flex-col">
        <div className="p-4 border-b border-border dark:border-border-dark">
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Admin Panel</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors',
                activeTab === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/50',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {content[activeTab]}
      </main>
    </div>
  );
}
