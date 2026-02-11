import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import {
  Activity,
  Server,
  Cpu,
  HardDrive,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Terminal,
  Box,
  Bell,
  Menu,
  X,
  Plus,
  Trash2,
  Settings,
  ChevronRight,
  ChevronLeft,
  MemoryStick,
  Shield,
  Eye,
  EyeOff,
  Send,
  Circle,
  BarChart3,
  Wifi,
  PlayCircle,
  StopCircle,
  RotateCcw,
  ChevronDown,
  Info,
  Gauge,
  Zap,
  TrendingUp,
  ShieldAlert,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
} from 'lucide-react';
import './index.css';

const API_BASE = "http://192.168.96.6:3000";

// ─── Toast Notification System ──────────────────────────────────

const ToastContext = createContext(null);

function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback({
    info: (msg, dur) => addToast(msg, 'info', dur),
    success: (msg, dur) => addToast(msg, 'success', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
  }, [addToast]);

  // Wrap toast functions
  const api = { toast: addToast, info: toast.info, success: toast.success, warning: toast.warning, error: toast.error, removeToast };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg border text-sm animate-slide-in backdrop-blur-sm
              ${t.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' :
                t.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-800' :
                t.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' :
                'bg-white/95 border-gray-200 text-gray-800'}`}>
            <span className="shrink-0 mt-0.5">
              {t.type === 'error' ? <XCircle className="w-4 h-4" /> :
               t.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
               t.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
               <Info className="w-4 h-4" />}
            </span>
            <span className="flex-1 text-[13px] leading-snug">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="shrink-0 p-0.5 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Utility Hooks ──────────────────────────────────────────────

function useApi(url, pollInterval = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}${url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? json);
      setError(null);
    } catch (err) {
      setError(err.message);
      if (toast) toast.error(`API error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    if (pollInterval && url) {
      const id = setInterval(fetchData, pollInterval);
      return () => clearInterval(id);
    }
  }, [fetchData, pollInterval, url]);

  return { data, loading, error, refetch: fetchData };
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

// ─── Shared Components ──────────────────────────────────────────

const StatusDot = ({ status }) => {
  const color = {
    online: 'bg-emerald-500', active: 'bg-emerald-500', running: 'bg-emerald-500', healthy: 'bg-emerald-500',
    warning: 'bg-amber-500', unhealthy: 'bg-red-500', offline: 'bg-red-500', exited: 'bg-gray-400', error: 'bg-red-500',
  }[status?.toLowerCase()] || 'bg-gray-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
};

const StatusBadge = ({ status }) => {
  const cfg = {
    online: { cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20', Icon: CheckCircle },
    active: { cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20', Icon: CheckCircle },
    running: { cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20', Icon: PlayCircle },
    healthy: { cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20', Icon: CheckCircle },
    warning: { cls: 'bg-amber-500/10 text-amber-700 ring-amber-500/20', Icon: AlertTriangle },
    unhealthy: { cls: 'bg-red-500/10 text-red-700 ring-red-500/20', Icon: AlertTriangle },
    offline: { cls: 'bg-red-500/10 text-red-700 ring-red-500/20', Icon: XCircle },
    exited: { cls: 'bg-gray-500/10 text-gray-600 ring-gray-500/20', Icon: StopCircle },
    error: { cls: 'bg-red-500/10 text-red-700 ring-red-500/20', Icon: XCircle },
  }[status?.toLowerCase()] || { cls: 'bg-gray-500/10 text-gray-600 ring-gray-500/20', Icon: Circle };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {status || 'Unknown'}
    </span>
  );
};

const COLOR_MAP = { blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500' };

const ProgressBar = ({ value, max = 100, color = 'blue', size = 'md' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const h = size === 'sm' ? 'h-1' : size === 'xs' ? 'h-0.5' : 'h-1.5';
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : (COLOR_MAP[color] || 'bg-blue-500');
  return (
    <div className={`w-full ${h} bg-gray-100 rounded-full overflow-hidden`}>
      <div className={`${h} rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-xl border border-gray-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`} {...props}>{children}</div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="text-center py-12">
    <Icon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
    <p className="text-sm font-medium text-gray-500">{title}</p>
    {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
  </div>
);

// ─── Add Machine Modal ──────────────────────────────────────────

const AddMachineModal = ({ open, onClose, onAdded }) => {
  const [hostname, setHostname] = useState('');
  const [user, setUser] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hostname || !user) { setErr('Hostname and user are required'); return; }
    setSubmitting(true); setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/machines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname, user, name: name || hostname }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      setHostname(''); setUser(''); setName('');
      toast.success('Machine added successfully');
      onAdded(); onClose();
    } catch (e) { setErr(e.message); toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Add Machine</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hostname / IP *</label>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="192.168.1.10" required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">SSH User *</label>
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="pi" required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Adding…' : 'Add Machine'}
          </button>
        </form>
      </Card>
    </div>
  );
};

// ─── Stat Strip ─────────────────────────────────────────────────

const formatBytes = (mb) => {
  if (mb == null) return '–';
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
};

const StatStrip = ({ machines, anomalyCount = 0, warningCount = 0 }) => {
  const online = machines?.filter(m => m.status === 'online') ?? [];
  const total = machines?.length ?? 0;
  let totalMemUsed = 0, totalMemTotal = 0, totalDiskUsed = 0, totalDiskTotal = 0, cpuSum = 0, cpuCount = 0;
  for (const m of (machines ?? [])) {
    if (m.memory_used != null) totalMemUsed += m.memory_used;
    if (m.memory_total != null) totalMemTotal += m.memory_total;
    if (m.disk_used != null) totalDiskUsed += m.disk_used;
    if (m.disk_total != null) totalDiskTotal += m.disk_total;
    if (m.cpu_usage != null) { cpuSum += m.cpu_usage; cpuCount++; }
  }
  const avgCpu = cpuCount > 0 ? Math.round(cpuSum / cpuCount * 10) / 10 : null;
  const memPct = totalMemTotal > 0 ? Math.round((totalMemUsed / totalMemTotal) * 100) : null;
  const diskPct = totalDiskTotal > 0 ? Math.round((totalDiskUsed / totalDiskTotal) * 100) : null;

  const stats = [
    { label: 'Hosts', value: `${online.length}/${total}`, sub: 'online', color: online.length === total ? 'text-emerald-600' : 'text-amber-600', Icon: Server },
    { label: 'CPU', value: avgCpu != null ? `${avgCpu}%` : '–', sub: `${cpuCount} reporting`, color: avgCpu > 80 ? 'text-red-600' : 'text-gray-900', Icon: Cpu },
    { label: 'Memory', value: memPct != null ? `${memPct}%` : '–', sub: `${formatBytes(totalMemUsed)} / ${formatBytes(totalMemTotal)}`, color: memPct > 80 ? 'text-red-600' : 'text-gray-900', Icon: MemoryStick },
    { label: 'Disk', value: diskPct != null ? `${diskPct}%` : '–', sub: `${formatBytes(totalDiskUsed)} / ${formatBytes(totalDiskTotal)}`, color: diskPct > 85 ? 'text-red-600' : 'text-gray-900', Icon: HardDrive },
    { label: 'Anomalies', value: anomalyCount, sub: 'detected', color: anomalyCount > 0 ? 'text-amber-600' : 'text-gray-400', Icon: Zap },
    { label: 'Forecasts', value: warningCount, sub: 'warnings', color: warningCount > 0 ? 'text-red-600' : 'text-gray-400', Icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-px bg-gray-200/60 rounded-xl overflow-hidden border border-gray-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {stats.map(({ label, value, sub, color, Icon }) => (
        <div key={label} className="bg-white px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider leading-none">{label}</p>
            <p className={`text-base sm:text-lg font-bold leading-tight tabular-nums ${color}`}>{value}</p>
            <p className="text-[9px] text-gray-400 leading-none mt-0.5 truncate">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Dashboard Tab ──────────────────────────────────────────────

const DashboardTab = () => {
  const { data: machines, loading, error, refetch } = useApi('/api/machines', 5000);
  const { data: anomalies } = useApi('/api/anomalies?limit=5', 15000);
  const { data: forecastData } = useApi('/api/forecasts', 30000);
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();

  const anomalyList = Array.isArray(anomalies) ? anomalies : [];
  const forecasts = forecastData?.data ?? (Array.isArray(forecastData) ? forecastData : []);
  const warnings = forecasts.filter(f => f.hasWarning);

  const handleDelete = async (id) => {
    if (!confirm('Delete this machine and all its data?')) return;
    await fetch(`${API_BASE}/api/machines/${id}`, { method: 'DELETE' });
    toast.success('Machine deleted');
    refetch();
  };

  return (
    <div className="space-y-3">
      {/* Stat Strip */}
      <StatStrip machines={machines} anomalyCount={anomalyList.length} warningCount={warnings.length} />

      {/* Alert Banners — compact */}
      {(anomalyList.length > 0 || warnings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {anomalyList.length > 0 && (
            <Card className="p-2.5 border-amber-200/60 bg-amber-50/30">
              <div className="flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800">Recent Anomalies</p>
                  <div className="mt-1.5 space-y-0.5">
                    {anomalyList.slice(0, 3).map((a, i) => (
                      <p key={i} className="text-[11px] text-amber-700 truncate">
                        <span className="font-medium">{a.metric || a.type}</span> · machine #{a.machine_id} — {a.message || `val: ${a.value}`}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
          {warnings.length > 0 && (
            <Card className="p-2.5 border-red-200/60 bg-red-50/30">
              <div className="flex items-start gap-2.5">
                <TrendingUp className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-800">Capacity Warnings</p>
                  <div className="mt-1.5 space-y-0.5">
                    {warnings.slice(0, 3).map((w, i) => (
                      <p key={i} className="text-[11px] text-red-700 truncate">
                        <span className="font-medium">{w.metric}</span> · machine #{w.machineId} — {w.warning || 'threshold approaching'}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Machine
        </button>
        <button onClick={refetch}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Machine Cards — dense grid */}
      {error ? (
        <Card className="p-4">
          <div className="flex items-center gap-2.5 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs">Error: {error}. Is the backend running?</p>
            <button onClick={refetch} className="ml-auto text-xs underline">Retry</button>
          </div>
        </Card>
      ) : loading && !machines ? <Spinner /> : !machines || machines.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Server} title="No machines yet" description="Add a machine to start monitoring." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
          {machines.map((m) => <MachineCard key={m.id} machine={m} onDelete={handleDelete} />)}
        </div>
      )}

      <AddMachineModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={refetch} />
    </div>
  );
};

// ─── Machine Card (Numeric-Dominant Redesign) ───────────────────

const MachineCard = ({ machine: m, onDelete }) => {
  const memPct = m.memory_total > 0 ? Math.round((m.memory_used / m.memory_total) * 100) : null;
  const diskPct = m.disk_total > 0 ? Math.round((m.disk_used / m.disk_total) * 100) : null;
  const cpuPct = m.cpu_usage != null ? Math.round(m.cpu_usage) : null;
  const hasZfs = m.zfs_total != null && m.zfs_total > 0;
  const zfsPct = hasZfs ? Math.round((m.zfs_used / m.zfs_total) * 100) : null;
  const hasLoad = m.load_1 != null && m.load_1 > 0;

  const metricColor = (v, warn = 70, crit = 90) =>
    v == null ? 'text-gray-300' : v >= crit ? 'text-red-600' : v >= warn ? 'text-amber-600' : 'text-gray-900';

  const zfsHealthColor = (h) =>
    !h ? 'text-gray-300' : h === 'ONLINE' ? 'text-emerald-600' : h === 'DEGRADED' ? 'text-amber-600' : 'text-red-600';

  return (
    <Card className="p-2.5 hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusDot status={m.status} />
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-gray-900 truncate leading-tight">{m.name || m.hostname}</h3>
            <p className="text-[9px] text-gray-400 truncate leading-tight">{m.hostname} · {m.user}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={m.status} />
          <button onClick={() => onDelete(m.id)}
            className="p-0.5 text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded hover:bg-red-50"
            title="Delete"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Primary metrics — large numbers */}
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        <div className="text-center">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">CPU</p>
          <p className={`text-[22px] font-extrabold tabular-nums leading-none ${metricColor(cpuPct)}`}>
            {cpuPct != null ? cpuPct : '–'}<span className="text-[10px] font-semibold">%</span>
          </p>
          <ProgressBar value={cpuPct || 0} color="blue" size="xs" />
        </div>
        <div className="text-center">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">MEM</p>
          <p className={`text-[22px] font-extrabold tabular-nums leading-none ${metricColor(memPct)}`}>
            {memPct != null ? memPct : '–'}<span className="text-[10px] font-semibold">%</span>
          </p>
          <ProgressBar value={memPct || 0} color="violet" size="xs" />
        </div>
        <div className="text-center">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">DISK</p>
          <p className={`text-[22px] font-extrabold tabular-nums leading-none ${metricColor(diskPct, 75, 85)}`}>
            {diskPct != null ? diskPct : '–'}<span className="text-[10px] font-semibold">%</span>
          </p>
          <ProgressBar value={diskPct || 0} color="emerald" size="xs" />
        </div>
      </div>

      {/* Sub-values row */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        <p className="text-[9px] text-gray-400 tabular-nums text-center leading-none">
          {hasLoad ? `load ${m.load_1?.toFixed(1)}` : '\u00A0'}
        </p>
        <p className="text-[9px] text-gray-400 tabular-nums text-center leading-none">
          {m.memory_total > 0 ? `${formatBytes(m.memory_used)}/${formatBytes(m.memory_total)}` : '\u00A0'}
        </p>
        <p className="text-[9px] text-gray-400 tabular-nums text-center leading-none">
          {m.disk_total > 0 ? `${formatBytes(m.disk_used)}/${formatBytes(m.disk_total)}` : '\u00A0'}
        </p>
      </div>

      {/* ZFS + Load detail row (conditional) */}
      {(hasZfs || hasLoad) && (
        <div className={`grid gap-1.5 mb-2 ${hasZfs && hasLoad ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasLoad && (
            <div className="bg-gray-50/80 rounded px-2 py-1">
              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Load 1 / 5 / 15</p>
              <p className="text-[11px] font-bold tabular-nums text-gray-700 leading-tight">
                <span className={m.load_1 > 4 ? 'text-red-600' : m.load_1 > 2 ? 'text-amber-600' : ''}>{m.load_1?.toFixed(2)}</span>
                {' / '}{m.load_5?.toFixed(2)}{' / '}{m.load_15?.toFixed(2)}
              </p>
            </div>
          )}
          {hasZfs && (
            <div className="bg-gray-50/80 rounded px-2 py-1">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">ZFS</p>
                <span className={`text-[8px] font-bold ${zfsHealthColor(m.zfs_health)}`}>{m.zfs_health}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[11px] font-bold tabular-nums ${metricColor(zfsPct, 70, 85)}`}>{zfsPct}%</span>
                <span className="text-[9px] text-gray-400 tabular-nums">{formatBytes(m.zfs_used)}/{formatBytes(m.zfs_total)}</span>
              </div>
              <ProgressBar value={zfsPct || 0} color="emerald" size="xs" />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {m.last_seen ? new Date(m.last_seen).toLocaleTimeString() : 'Never'}
        </span>
      </div>
    </Card>
  );
};

// ─── Metrics Tab ────────────────────────────────────────────────

const UptimeChart = ({ machineId }) => {
  const { data: uptimeResp, loading } = useApi(machineId ? `/api/uptime/${machineId}?days=30` : null, machineId ? 60000 : null);
  const uptimeData = uptimeResp?.data ?? uptimeResp ?? [];
  if (loading && !uptimeData.length) return null;
  if (!uptimeData.length) return null;

  const getColor = (pct) => {
    if (pct === 0) return 'bg-gray-200';
    if (pct < 50) return 'bg-red-500';
    if (pct < 75) return 'bg-amber-400';
    if (pct < 95) return 'bg-emerald-400';
    return 'bg-emerald-500';
  };

  const totalUptime = uptimeData.reduce((s, d) => s + d.uptimeMinutes, 0);
  const totalPossible = uptimeData.length * 1440;
  const overallPct = totalPossible > 0 ? Math.round((totalUptime / totalPossible) * 100) : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Uptime — 30 Days</h3>
        <span className={`text-sm font-bold tabular-nums ${overallPct >= 95 ? 'text-emerald-600' : overallPct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
          {overallPct}%
        </span>
      </div>
      <div className="flex gap-[2px]">
        {uptimeData.map((d) => (
          <div key={d.date} className="flex-1 group relative">
            <div className={`w-full rounded-sm ${getColor(d.uptimePct)}`} style={{ height: '24px' }} />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {d.date}: {d.uptimePct}%
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400">{uptimeData[0]?.date}</span>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-gray-200 inline-block" />0%</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />&lt;50</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />50-94</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />95+</span>
        </div>
        <span className="text-[10px] text-gray-400">{uptimeData[uptimeData.length - 1]?.date}</span>
      </div>
    </Card>
  );
};

const MetricsTab = () => {
  const { data: machines } = useApi('/api/machines', 10000);
  const [selectedId, setSelectedId] = useState(null);
  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;
  const { data: metrics, loading } = useApi(effectiveId ? `/api/metrics/${effectiveId}?limit=50` : null, effectiveId ? 10000 : null);
  const metricsData = metrics?.data ?? metrics ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <h2 className="text-base font-bold text-gray-900">Historical Metrics</h2>
        {machines?.length > 0 && (
          <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full sm:w-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
          </select>
        )}
      </div>

      {effectiveId && <UptimeChart machineId={effectiveId} />}

      {loading && !metricsData.length ? <Spinner /> : !metricsData.length ? (
        <Card className="p-6"><EmptyState icon={BarChart3} title="No metrics yet" description="Metrics will appear after the first collection cycle." /></Card>
      ) : (
        <>
          {/* CPU + Memory side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">CPU Usage</h3>
              <div className="flex items-end gap-[2px] h-24">
                {[...metricsData].reverse().map((m, i) => {
                  const pct = Math.max(1, Math.round(m.cpu_usage || 0));
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-blue-500';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className={`w-full ${barColor} rounded-t transition-all min-w-[2px]`} style={{ height: `${pct}%` }} />
                      <div className="absolute -top-7 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {Math.round(m.cpu_usage || 0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Memory Usage</h3>
              <div className="flex items-end gap-[2px] h-24">
                {[...metricsData].reverse().map((m, i) => {
                  const pct = m.memory_total > 0 ? Math.max(1, Math.round((m.memory_used / m.memory_total) * 100)) : 0;
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-violet-500';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className={`w-full ${barColor} rounded-t transition-all min-w-[2px]`} style={{ height: `${pct}%` }} />
                      <div className="absolute -top-7 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Compact Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/80 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">CPU</th>
                    <th className="px-3 py-2">Memory</th>
                    <th className="px-3 py-2 hidden sm:table-cell">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {metricsData.slice(0, 20).map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{new Date(m.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-1.5 font-mono font-medium">{m.cpu_usage != null ? `${Math.round(m.cpu_usage)}%` : '–'}</td>
                      <td className="px-3 py-1.5 font-mono">{m.memory_total > 0 ? `${m.memory_used}/${m.memory_total}` : '–'}</td>
                      <td className="px-3 py-1.5 font-mono hidden sm:table-cell">{m.disk_total > 0 ? `${m.disk_used}/${m.disk_total}` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

// ─── Logs Tab ───────────────────────────────────────────────────

const LogsTab = () => {
  const { data: machines } = useApi('/api/machines');
  const { data: levels } = useApi('/api/logs/levels');
  const [keyword, setKeyword] = useState('');
  const [machineId, setMachineId] = useState('');
  const [level, setLevel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (machineId) params.set('machine_id', machineId);
      if (level) params.set('level', level);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('page', p); params.set('limit', '50');
      const res = await fetch(`${API_BASE}/api/logs/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResults(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [keyword, machineId, level, dateFrom, dateTo, page]);

  useEffect(() => { fetchLogs(page); }, [page]);

  const handleSearch = (e) => { e?.preventDefault(); setPage(1); fetchLogs(1); };
  const handleReset = () => { setKeyword(''); setMachineId(''); setLevel(''); setDateFrom(''); setDateTo(''); setPage(1); setTimeout(() => fetchLogs(1), 0); };

  const levelColors = {
    error: 'bg-red-500/10 text-red-700 ring-red-500/20',
    warn: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
    warning: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
    info: 'bg-blue-500/10 text-blue-700 ring-blue-500/20',
    debug: 'bg-gray-500/10 text-gray-600 ring-gray-500/20',
  };

  const pagination = results?.pagination;
  const logs = results?.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-900">Log Search</h2>
      <Card className="p-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search log messages…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            <Terminal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={machineId} onChange={(e) => setMachineId(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">All Machines</option>
              {(machines ?? []).map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">All Levels</option>
              {(levels ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date"
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
            <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date"
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
              <Terminal className="w-3.5 h-3.5" /> Search
            </button>
            <button type="button" onClick={handleReset} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            {pagination && <span className="text-[10px] text-gray-400 ml-auto">{pagination.total} result{pagination.total !== 1 ? 's' : ''}</span>}
          </div>
        </form>
      </Card>

      {error ? (
        <Card className="p-4"><div className="flex items-center gap-2 text-red-700"><AlertTriangle className="w-4 h-4 shrink-0" /><p className="text-xs">Error: {error}</p><button onClick={() => fetchLogs(page)} className="ml-auto text-xs underline">Retry</button></div></Card>
      ) : loading && !logs.length ? <Spinner /> : logs.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Terminal} title="No logs found" description="Try adjusting your search filters." /></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50/80 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2 w-36">Timestamp</th><th className="px-3 py-2 w-16">Level</th>
                  <th className="px-3 py-2 w-28">Machine</th><th className="px-3 py-2">Message</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '–'}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ring-inset ${levelColors[log.level?.toLowerCase()] || 'bg-gray-500/10 text-gray-600 ring-gray-500/20'}`}>{log.level || '–'}</span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 truncate max-w-[7rem]">{log.machine_name || log.machine_hostname || `#${log.machine_id}`}</td>
                      <td className="px-3 py-1.5 text-gray-700 font-mono break-all">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Prev</button>
              <span className="text-xs text-gray-500">{pagination.page}/{pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Containers Tab ─────────────────────────────────────────────

const ContainersTab = () => {
  const { data: machines } = useApi('/api/machines', 15000);
  const [selectedId, setSelectedId] = useState(null);
  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;
  const { data: containers, loading, refetch } = useApi(effectiveId ? `/api/containers/${effectiveId}` : null, effectiveId ? 10000 : null);
  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const toast = useToast();
  const containerData = containers ?? [];

  const updatePolicy = async (containerId, maxRetries, gracePeriod) => {
    await fetch(`${API_BASE}/api/containers/policy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId, maxRetries, gracePeriod }),
    });
    toast.success('Policy updated');
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <h2 className="text-base font-bold text-gray-900">Containers</h2>
        {machines?.length > 0 && (
          <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full sm:w-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
          </select>
        )}
      </div>

      {loading && !containerData.length ? <Spinner /> : !containerData.length ? (
        <Card className="p-6"><EmptyState icon={Box} title="No containers found" description="Docker containers will appear here after collection." /></Card>
      ) : (
        <div className="space-y-2">
          {containerData.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusDot status={c.state} />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{c.name}</h4>
                      <p className="text-[10px] text-gray-400 truncate font-mono">{c.image}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={c.state} />
                    {c.health_status && c.health_status !== 'unknown' && c.health_status !== 'not_running' && <StatusBadge status={c.health_status} />}
                    <button onClick={() => setExpandedPolicy(expandedPolicy === c.id ? null : c.id)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" title="Auto-heal policy">
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{c.status}</p>
              </div>
              {expandedPolicy === c.id && <PolicyEditor container={c} onSave={(mr, gp) => updatePolicy(c.id, mr, gp)} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const PolicyEditor = ({ container: c, onSave }) => {
  const [maxRetries, setMaxRetries] = useState(c.max_retries ?? 3);
  const [gracePeriod, setGracePeriod] = useState(c.grace_period ?? 60);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => { setSaving(true); await onSave(maxRetries, gracePeriod); setSaving(false); };

  return (
    <div className="px-3.5 pb-3.5 pt-0">
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Auto-Heal Policy</h5>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-500 block mb-0.5">Max Retries</label>
            <input type="number" min="0" max="99" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="text-[10px] text-gray-500 block mb-0.5">Grace Period (s)</label>
            <input type="number" min="0" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))}
              className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>Retries: {c.current_retries ?? 0} · Last: {c.last_restart ? new Date(c.last_restart).toLocaleString() : 'Never'}</span>
          <button onClick={handleSave} disabled={saving}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Alerts Tab ─────────────────────────────────────────────────

const AlertsTab = () => {
  const { data: anomalies, loading: anomLoading, refetch: refetchAnom } = useApi('/api/anomalies?limit=50', 15000);
  const { data: forecastResp, loading: fcLoading } = useApi('/api/forecasts', 30000);
  const [detecting, setDetecting] = useState(false);
  const toast = useToast();
  const anomalyList = Array.isArray(anomalies) ? anomalies : [];
  const forecasts = forecastResp?.data ?? (Array.isArray(forecastResp) ? forecastResp : []);

  const triggerDetection = async () => {
    setDetecting(true);
    try { await fetch(`${API_BASE}/api/anomalies/detect`, { method: 'POST' }); refetchAnom(); toast.success('Detection complete'); }
    catch (e) { toast.error(e.message); }
    finally { setDetecting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Anomalies & Forecasts</h2>
        <button onClick={triggerDetection} disabled={detecting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
          <Zap className={`w-3.5 h-3.5 ${detecting ? 'animate-pulse' : ''}`} /> {detecting ? 'Detecting…' : 'Run Detection'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Anomalies */}
        <div>
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Anomalies</h3>
          {anomLoading && !anomalyList.length ? <Spinner /> : anomalyList.length === 0 ? (
            <Card className="p-4"><EmptyState icon={CheckCircle} title="All clear" description="No anomalies detected." /></Card>
          ) : (
            <div className="space-y-1.5">
              {anomalyList.map((a, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900">{a.metric || a.type || 'Anomaly'}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">#{a.machine_id}</span>
                        {a.severity && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${a.severity === 'high' || a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.severity}</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{a.message || `Value: ${a.value}`}</p>
                      {a.detected_at && <p className="text-[10px] text-gray-400 mt-0.5">{new Date(a.detected_at).toLocaleString()}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Forecasts */}
        <div>
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Forecasts</h3>
          {fcLoading && !forecasts.length ? <Spinner /> : forecasts.length === 0 ? (
            <Card className="p-4"><EmptyState icon={TrendingUp} title="No data" description="Forecasts require metric history." /></Card>
          ) : (
            <div className="space-y-1.5">
              {forecasts.map((f, i) => (
                <Card key={i} className={`p-3 ${f.hasWarning ? 'border-red-200/60' : ''}`}>
                  <div className="flex items-start gap-2">
                    <TrendingUp className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${f.hasWarning ? 'text-red-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900">{f.metric || 'Resource'}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">#{f.machineId}</span>
                        {f.hasWarning && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Warning</span>}
                      </div>
                      {f.warning && <p className="text-[10px] text-red-600 mt-0.5">{f.warning}</p>}
                      {f.forecast && <p className="text-[10px] text-gray-500 mt-0.5">Forecast: {typeof f.forecast === 'number' ? `${Math.round(f.forecast)}%` : JSON.stringify(f.forecast)}</p>}
                      {f.daysUntilFull != null && f.daysUntilFull !== Infinity && <p className="text-[10px] text-gray-500">~{Math.round(f.daysUntilFull)} days until full</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Terminal Tab ───────────────────────────────────────────────

const WS_BASE = API_BASE.replace(/^http/, 'ws');

const TerminalTab = () => {
  const { data: machines } = useApi('/api/machines');
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const termRef = useRef(null);
  const termContainerRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);

  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;

  const disconnect = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (termRef.current) { termRef.current.dispose(); termRef.current = null; }
    fitAddonRef.current = null;
    setConnected(false);
    setError(null);
  }, []);

  const connect = useCallback(async (machineId) => {
    disconnect();
    if (!machineId) return;
    setError(null);

    const { Terminal: XTerminal } = await import('xterm');
    const { FitAddon } = await import('xterm-addon-fit');
    await import('xterm/css/xterm.css');

    const term = new XTerminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        selectionBackground: '#334155',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (termContainerRef.current) {
      termContainerRef.current.innerHTML = '';
      term.open(termContainerRef.current);
      setTimeout(() => fitAddon.fit(), 50);
    }

    term.write('\x1b[1;34mConnecting…\x1b[0m\r\n');

    const ws = new WebSocket(`${WS_BASE}/ws/terminal?machineId=${machineId}`);
    wsRef.current = ws;

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string' && data.startsWith('{"type":')) {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'status' && msg.message === 'connected') {
            setConnected(true);
            term.clear();
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            return;
          }
          if (msg.type === 'error') {
            setError(msg.message);
            term.write(`\r\n\x1b[1;31mError: ${msg.message}\x1b[0m\r\n`);
            return;
          }
        } catch (_) {}
      }
      term.write(data);
    };

    ws.onclose = () => {
      setConnected(false);
      if (termRef.current) {
        term.write('\r\n\x1b[1;33mDisconnected.\x1b[0m\r\n');
      }
    };

    ws.onerror = () => { setError('WebSocket connection failed'); };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    });
  }, [disconnect]);

  useEffect(() => {
    const handleResize = () => { if (fitAddonRef.current) try { fitAddonRef.current.fit(); } catch (_) {} };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">SSH Terminal</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {machines?.length > 0 && (
            <select value={effectiveId || ''} onChange={(e) => { setSelectedId(Number(e.target.value)); disconnect(); }}
              className="flex-1 sm:flex-none sm:w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
            </select>
          )}
          {!connected ? (
            <button onClick={() => connect(effectiveId)} disabled={!effectiveId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              <Terminal className="w-3.5 h-3.5" /> Connect
            </button>
          ) : (
            <button onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
              <XCircle className="w-3.5 h-3.5" /> Disconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <Card className="p-3 border-red-200/60 bg-red-50/30">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
          </div>
          <span className="text-[10px] text-gray-400 ml-1.5 font-mono">
            {connected ? `${machines?.find(m => m.id === effectiveId)?.user}@${machines?.find(m => m.id === effectiveId)?.hostname}` : 'disconnected'}
          </span>
          {connected && <span className="ml-auto text-[10px] text-emerald-400 font-medium">● LIVE</span>}
        </div>
        <div ref={termContainerRef} className="bg-[#0f172a]" style={{ minHeight: '360px', padding: connected ? '4px' : '0' }}>
          {!connected && !error && (
            <div className="flex items-center justify-center h-[360px] text-gray-500">
              <div className="text-center space-y-2">
                <Terminal className="w-8 h-8 mx-auto text-gray-600" />
                <p className="text-xs">Select a machine and click <strong>Connect</strong></p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// ─── Settings Tab ───────────────────────────────────────────────

const ALERT_TYPES = [
  { value: 'machine_offline', label: 'Machine Offline' },
  { value: 'high_cpu', label: 'High CPU' },
  { value: 'high_memory', label: 'High Memory' },
  { value: 'high_disk', label: 'High Disk' },
  { value: 'unhealthy_container', label: 'Unhealthy Container' },
];

const WebhookSettings = () => {
  const { data: webhooks, loading, refetch } = useApi('/api/webhooks', null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'discord', url: '', events: [] });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const toast = useToast();
  const webhookList = webhooks ?? [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.url) { setErr('Name and URL are required'); return; }
    setSubmitting(true); setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/webhooks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      setForm({ name: '', type: 'discord', url: '', events: [] }); setShowAdd(false); toast.success('Webhook added'); refetch();
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete this webhook?')) return; await fetch(`${API_BASE}/api/webhooks/${id}`, { method: 'DELETE' }); toast.success('Webhook deleted'); refetch(); };
  const handleToggle = async (wh) => { await fetch(`${API_BASE}/api/webhooks/${wh.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !wh.enabled }) }); refetch(); };
  const handleTest = async (id) => {
    setTesting(id); setTestResult({});
    try { const res = await fetch(`${API_BASE}/api/webhooks/${id}/test`, { method: 'POST' }); const j = await res.json(); setTestResult({ [id]: res.ok ? '✅' : `❌ ${j.error}` }); if (res.ok) toast.success('Test sent!'); }
    catch (e) { setTestResult({ [id]: `❌ ${e.message}` }); toast.error(e.message); }
    finally { setTesting(null); }
  };
  const toggleEvent = (evt) => setForm(f => ({ ...f, events: f.events.includes(evt) ? f.events.filter(e => e !== evt) : [...f.events, evt] }));

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-violet-50 rounded-lg shrink-0"><Send className="w-5 h-5 text-violet-600" /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Alert Webhooks</h3>
            <button onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-medium hover:bg-violet-700 transition-colors">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Send alerts to Discord or Telegram.</p>

          {showAdd && (
            <form onSubmit={handleAdd} className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="text-[10px] text-gray-500 block mb-0.5">Name *</label>
                  <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Discord Alert"
                    className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
                  <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                    <option value="discord">Discord</option><option value="telegram">Telegram</option><option value="generic">Generic</option>
                  </select></div>
              </div>
              <div><label className="text-[10px] text-gray-500 block mb-0.5">URL *</label>
                <input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-500 font-mono" /></div>
              <div><label className="text-[10px] text-gray-500 block mb-0.5">Events (empty = all)</label>
                <div className="flex flex-wrap gap-1">
                  {ALERT_TYPES.map(at => (
                    <button key={at.value} type="button" onClick={() => toggleEvent(at.value)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${form.events.includes(at.value) ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-200'}`}>
                      {at.label}
                    </button>
                  ))}
                </div></div>
              {err && <p className="text-[10px] text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="px-3 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-medium hover:bg-violet-700 disabled:opacity-50">{submitting ? 'Adding…' : 'Add'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setErr(''); }} className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-[10px] font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}

          {loading ? <div className="text-xs text-gray-400">Loading…</div> : webhookList.length === 0 ? (
            <div className="text-xs text-gray-400 py-3 text-center">No webhooks configured.</div>
          ) : (
            <div className="space-y-1.5">
              {webhookList.map(wh => (
                <div key={wh.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${wh.enabled ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <StatusDot status={wh.enabled ? 'online' : 'offline'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-900 truncate">{wh.name}</span>
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded uppercase">{wh.type}</span>
                    </div>
                    {wh.events?.length > 0 && <div className="flex flex-wrap gap-0.5 mt-0.5">{wh.events.map(e => <span key={e} className="text-[9px] bg-violet-50 text-violet-600 px-1 py-0.5 rounded">{e}</span>)}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id} className="p-1 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600 transition-colors" title="Test">
                      <Zap className={`w-3.5 h-3.5 ${testing === wh.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button onClick={() => handleToggle(wh)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors" title={wh.enabled ? 'Disable' : 'Enable'}>
                      {wh.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDelete(wh.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {testResult[wh.id] && <span className="text-[10px] ml-1">{testResult[wh.id]}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const NotifToggle = ({ label, defaultOn = false }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-gray-700 group-hover:text-gray-900">{label}</span>
      <button onClick={() => setOn(!on)} role="switch" aria-checked={on}
        className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
};

const SettingsTab = () => {
  const [collectStatus, setCollectStatus] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const toast = useToast();

  const triggerCollect = async () => {
    setCollecting(true); setCollectStatus(null);
    try { const res = await fetch(`${API_BASE}/api/collect`, { method: 'POST' }); const json = await res.json(); setCollectStatus({ ok: res.ok, message: json.message || json.error }); if (res.ok) toast.success('Collection complete'); }
    catch (e) { setCollectStatus({ ok: false, message: e.message }); toast.error(e.message); }
    finally { setCollecting(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-base font-bold text-gray-900">Settings</h2>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg shrink-0"><RefreshCw className="w-5 h-5 text-blue-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Data Collection</h3>
            <p className="text-xs text-gray-500 mt-0.5">Auto-collects every 60s. Trigger manual below.</p>
            <button onClick={triggerCollect} disabled={collecting}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`} /> {collecting ? 'Collecting…' : 'Collect Now'}
            </button>
            {collectStatus && <p className={`text-xs mt-1.5 ${collectStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>{collectStatus.message}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-50 rounded-lg shrink-0"><Bell className="w-5 h-5 text-amber-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">Configure alert triggers.</p>
            <div className="space-y-2.5">
              <NotifToggle label="Machine goes offline" defaultOn />
              <NotifToggle label="Container becomes unhealthy" defaultOn />
              <NotifToggle label="CPU usage > 90%" defaultOn={false} />
              <NotifToggle label="Disk usage > 85%" defaultOn={false} />
              <NotifToggle label="Auto-heal retries exhausted" defaultOn />
              <NotifToggle label="Anomaly detected" defaultOn />
              <NotifToggle label="Capacity forecast warning" defaultOn={false} />
            </div>
          </div>
        </div>
      </Card>

      <WebhookSettings />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg shrink-0"><Shield className="w-5 h-5 text-emerald-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Setup Help</h3>
            <div className="mt-2 space-y-3 text-xs text-gray-600">
              <div>
                <h4 className="font-medium text-gray-800 mb-0.5">1. Configure SSH Keys</h4>
                <div className="bg-slate-900 text-green-400 text-[11px] font-mono rounded-lg p-2.5 overflow-x-auto leading-relaxed">
                  <p>ssh-keygen -t ed25519 -C "pulse-monitor"</p>
                  <p>ssh-copy-id -i ~/.ssh/id_ed25519.pub user@host</p>
                  <p>export SSH_KEY_PATH=~/.ssh/id_ed25519</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-0.5">2. Add Machines</h4>
                <p className="text-[11px] text-gray-500">Dashboard → Add Machine. Enter hostname/IP and SSH user.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-0.5">Troubleshooting</h4>
                <ul className="text-[11px] text-gray-500 list-disc list-inside space-y-0.5">
                  <li>Offline? Verify: <code className="bg-gray-100 px-1 rounded">ssh user@host "echo ok"</code></li>
                  <li>No metrics? Wait 60s or trigger collection</li>
                  <li>No containers? Ensure Docker + user has access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 rounded-lg shrink-0"><Info className="w-5 h-5 text-gray-500" /></div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">About Pulse</h3>
            <p className="text-xs text-gray-500 mt-0.5">Lightweight infrastructure monitoring via SSH. Metrics, containers, anomaly detection, auto-healing.</p>
            <p className="text-[10px] text-gray-400 mt-1">v1.0.0</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── Navigation Config ──────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: Gauge },
  { id: 'metrics', label: 'Metrics', Icon: BarChart3 },
  { id: 'logs', label: 'Logs', Icon: ScrollText },
  { id: 'alerts', label: 'Alerts', Icon: ShieldAlert },
  { id: 'containers', label: 'Containers', Icon: Box },
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

const MOBILE_NAV = ['dashboard', 'metrics', 'alerts', 'containers', 'settings'];

const TAB_COMPONENTS = {
  dashboard: DashboardTab,
  metrics: MetricsTab,
  logs: LogsTab,
  alerts: AlertsTab,
  containers: ContainersTab,
  terminal: TerminalTab,
  settings: SettingsTab,
};

// ─── App Shell ──────────────────────────────────────────────────

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && !isDesktop && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-gray-900 transform transition-all duration-200 ease-out flex flex-col
        lg:static lg:z-auto
        ${isDesktop ? (sidebarCollapsed ? 'w-[60px]' : 'w-56') : 'w-56'}
        ${!isDesktop && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 h-14 border-b border-gray-800 shrink-0 ${sidebarCollapsed && isDesktop ? 'justify-center px-2' : 'px-4'}`}>
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          {!(sidebarCollapsed && isDesktop) && <span className="text-base font-bold text-white tracking-tight">Pulse</span>}
          {!isDesktop && (
            <button className="ml-auto p-1" onClick={() => setSidebarOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto sidebar-scroll py-2 ${sidebarCollapsed && isDesktop ? 'px-1.5' : 'px-2'} space-y-0.5`}>
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
              className={`sidebar-btn relative w-full flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors
                ${sidebarCollapsed && isDesktop ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2'}
                ${activeTab === id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {!(sidebarCollapsed && isDesktop) && label}
              {sidebarCollapsed && isDesktop && (
                <div className="sidebar-tooltip absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap z-50">
                  {label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        {isDesktop && (
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center justify-center h-10 border-t border-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}

        {/* Status */}
        <div className={`shrink-0 border-t border-gray-800 p-3 ${sidebarCollapsed && isDesktop ? 'flex justify-center' : ''}`}>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {!(sidebarCollapsed && isDesktop) && <span>Active</span>}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 min-w-0 flex flex-col ${isMobile ? 'pb-14' : ''}`}>
        {/* Top bar — compact */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 h-12 flex items-center px-3 lg:px-6 gap-3 shrink-0">
          <button className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900 capitalize">{activeTab}</h1>
        </header>

        {/* Page content — tighter padding */}
        <div className="flex-1 p-2.5 lg:p-4 pb-safe overflow-y-auto">
          <ActiveComponent />
        </div>
      </main>

      {/* Mobile bottom nav — compact */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 bottom-nav-safe">
          <div className="flex items-center justify-around h-12">
            {MOBILE_NAV.map(id => {
              const item = NAV_ITEMS.find(n => n.id === id);
              if (!item) return null;
              const { Icon, label } = item;
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0
                    ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-[9px] font-medium truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
