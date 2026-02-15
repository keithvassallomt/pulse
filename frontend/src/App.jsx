import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import Recommendations from './Recommendations';
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
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import './index.css';

const isDev = window.location.port === '5173';
const API_BASE = isDev
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : window.location.origin;
const WS_BASE = API_BASE.replace(/^http/, 'ws');

// ─── Toast Notification System ──────────────────────────────────

const ToastContext = createContext(null);

function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    // Deduplicate: skip if an identical message+type toast is already visible
    if (toastsRef.current.some(t => t.message === message && t.type === type)) return -1;

    const id = ++toastId;
    const entry = { id, message, type };
    toastsRef.current = [...toastsRef.current, entry];
    setToasts(toastsRef.current);
    if (duration > 0) {
      setTimeout(() => {
        toastsRef.current = toastsRef.current.filter(t => t.id !== id);
        setToasts(toastsRef.current);
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    toastsRef.current = toastsRef.current.filter(t => t.id !== id);
    setToasts(toastsRef.current);
  }, []);

  const toast = useMemo(() => ({
    info: (msg, dur) => addToast(msg, 'info', dur),
    success: (msg, dur) => addToast(msg, 'success', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
  }), [addToast]);

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
                'bg-white/95 dark:bg-gray-800/95 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'}`}>
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
  const hadErrorRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}${url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? json);
      setError(null);
      hadErrorRef.current = false;
    } catch (err) {
      setError(err.message);
      // Only toast the first failure, not every poll
      if (!hadErrorRef.current && toast) {
        toast.error(`API error: ${err.message}`);
        hadErrorRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, [url, toast]);

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

// ─── Dark Mode ──────────────────────────────────────────────────

const ThemeContext = createContext({ theme: 'system', setTheme: () => {} });
const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('pulse-theme') || 'system'; } catch { return 'system'; }
  });
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) { root.classList.add('dark'); } else { root.classList.remove('dark'); }
  }, [isDark]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem('pulse-theme', t); } catch { /* storage unavailable */ void 0; }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>;
}

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const next = { light: 'dark', dark: 'system', system: 'light' }[theme] || 'light';
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';
  return (
    <button onClick={() => setTheme(next)} title={`Theme: ${label} (click for ${next})`}
      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
      <Icon className="w-4 h-4" />
    </button>
  );
};

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
    <div className={`w-full ${h} bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden`}>
      <div className={`${h} rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] ${className}`} {...props}>{children}</div>
);

const formatAnomalyValue = (v) => {
  if (v == null) return '–';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const SEVERITY_CFG = {
  critical: { cls: 'bg-red-100 text-red-700 ring-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-500/30', icon: XCircle },
  high: { cls: 'bg-red-100 text-red-700 ring-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-500/30', icon: AlertTriangle },
  medium: { cls: 'bg-amber-100 text-amber-700 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:ring-amber-500/30', icon: AlertTriangle },
  warning: { cls: 'bg-amber-100 text-amber-700 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:ring-amber-500/30', icon: AlertTriangle },
  low: { cls: 'bg-blue-100 text-blue-700 ring-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:ring-blue-500/30', icon: Info },
  info: { cls: 'bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:ring-gray-500/30', icon: Info },
};

const SeverityBadge = ({ severity }) => {
  const key = severity?.toLowerCase() || 'info';
  const cfg = SEVERITY_CFG[key] || SEVERITY_CFG.info;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${cfg.cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {severity || 'info'}
    </span>
  );
};

const MetricTypeBadge = ({ metric }) => {
  if (!metric) return null;
  const key = metric.toLowerCase();
  const cfg = key.includes('cpu') ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    : key.includes('mem') ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400'
    : key.includes('disk') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    : key.includes('load') ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${cfg}`}>
      {metric}
    </span>
  );
};

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
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Add Machine</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hostname / IP *</label>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="192.168.1.10" required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SSH User *</label>
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

const resolveMachineName = (machines, id) => {
  const m = (machines ?? []).find(m => m.id === id || m.id === Number(id));
  return m?.name || m?.hostname || `#${id}`;
};

const formatBytes = (mb) => {
  if (mb == null) return '–';
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
};

const formatBytesFromBytes = (bytes, options = {}) => {
  if (bytes == null) return '–';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  let value = Number(bytes);
  if (!Number.isFinite(value)) return '–';
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = options.precision ?? (value >= 10 || unitIndex === 0 ? 0 : 1);
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

const normalizeZfsPools = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const zfsHealthColor = (health, isOffline = false) => {
  if (!health) return 'text-gray-300';
  if (isOffline) return 'text-gray-400';
  if (health === 'ONLINE') return 'text-emerald-600';
  if (health === 'DEGRADED') return 'text-amber-600';
  return 'text-red-600';
};

const formatZfsValue = (value) => formatBytesFromBytes(value);

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
    { label: 'CPU', value: avgCpu != null ? `${avgCpu}%` : '–', sub: `${cpuCount} reporting`, color: avgCpu > 80 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100', Icon: Cpu },
    { label: 'Memory', value: memPct != null ? `${memPct}%` : '–', sub: `${formatBytes(totalMemUsed)} / ${formatBytes(totalMemTotal)}`, color: memPct > 80 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100', Icon: MemoryStick },
    { label: 'Disk', value: diskPct != null ? `${diskPct}%` : '–', sub: `${formatBytes(totalDiskUsed)} / ${formatBytes(totalDiskTotal)}`, color: diskPct > 85 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100', Icon: HardDrive },
    { label: 'Anomalies', value: anomalyCount, sub: 'detected', color: anomalyCount > 0 ? 'text-amber-600' : 'text-gray-400', Icon: Zap },
    { label: 'Forecasts', value: warningCount, sub: 'warnings', color: warningCount > 0 ? 'text-red-600' : 'text-gray-400', Icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-px bg-gray-200/60 dark:bg-gray-700/60 rounded-xl overflow-hidden border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {stats.map(({ label, value, sub, color, Icon }) => (
        <div key={label} className="bg-white dark:bg-gray-900 px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-2">
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
  const { data: recData } = useApi('/api/recommendations', 30000);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [isAnomaliesCollapsed, setIsAnomaliesCollapsed] = useState(true);
  const [isWarningsCollapsed, setIsWarningsCollapsed] = useState(true);
  const toast = useToast();

  const anomalyList = Array.isArray(anomalies) ? anomalies : [];
  const forecasts = forecastData?.data ?? (Array.isArray(forecastData) ? forecastData : []);
  const warnings = forecasts.filter(f => f.hasWarning);

  const filteredSelectedIds = useMemo(() => {
    if (!machines) return selectedIds;
    const machineIdSet = new Set(machines.map(m => m.id));
    return selectedIds.filter(id => machineIdSet.has(id));
  }, [machines, selectedIds]);

  const selectedCount = filteredSelectedIds.length;

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!machines || machines.length === 0) return;
    if (filteredSelectedIds.length === machines.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(machines.map(m => m.id));
    }
  }, [machines, filteredSelectedIds]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
          {anomalyList.length > 0 && (
            <Card className="p-0 overflow-hidden border-amber-200/60 dark:border-amber-500/30 shadow-sm">
              <div
                className="bg-amber-50/50 dark:bg-amber-500/10 px-3 py-2 border-b border-amber-100 dark:border-amber-500/20 flex items-center gap-2 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-500/20 transition-colors"
                onClick={() => setIsAnomaliesCollapsed(!isAnomaliesCollapsed)}
              >
                <ChevronDown className={`w-3.5 h-3.5 text-amber-600 transition-transform ${isAnomaliesCollapsed ? '-rotate-90' : ''}`} />
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-100">Recent Anomalies</h3>
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full">
                  {anomalyList.length}
                </span>
              </div>
              {!isAnomaliesCollapsed && (
                <>
                  <div className="divide-y divide-amber-100/50 dark:divide-amber-500/10">
                {anomalyList.slice(0, 5).map((a, i) => (
                  <div key={i} className="px-3 py-2 hover:bg-amber-50/30 dark:hover:bg-amber-500/5 transition-colors group">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                         <span className={`w-1.5 h-1.5 rounded-full ${
                           a.severity === 'critical' ? 'bg-red-500' :
                           a.severity === 'high' ? 'bg-orange-500' :
                           a.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                         }`} />
                         <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                           {resolveMachineName(machines, a.machine_id)}
                         </span>
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums">
                        {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <MetricTypeBadge metric={a.metric || a.type} />
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                            {formatAnomalyValue(a.value)}
                          </span>
                        </div>
                        {a.message && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 leading-tight">
                            {a.message}
                          </p>
                        )}
                      </div>
                      {a.severity && <SeverityBadge severity={a.severity} />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 text-center border-t border-gray-100 dark:border-gray-700/50">
                <button className="text-[10px] font-medium text-gray-500 hover:text-amber-600 transition-colors flex items-center justify-center gap-1 w-full">
                  View All Anomalies <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              </>
              )}
            </Card>
          )}
          {warnings.length > 0 && (
            <Card className="p-0 overflow-hidden border-red-200/60 dark:border-red-500/30 shadow-sm">
              <div
                className="bg-red-50/50 dark:bg-red-500/10 px-3 py-2 border-b border-red-100 dark:border-red-500/20 flex items-center gap-2 cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-500/20 transition-colors"
                onClick={() => setIsWarningsCollapsed(!isWarningsCollapsed)}
              >
                <ChevronDown className={`w-3.5 h-3.5 text-red-600 transition-transform ${isWarningsCollapsed ? '-rotate-90' : ''}`} />
                <TrendingUp className="w-3.5 h-3.5 text-red-600" />
                <h3 className="text-xs font-semibold text-red-900 dark:text-red-100">Capacity Warnings</h3>
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-full">
                  {warnings.length}
                </span>
              </div>
              {!isWarningsCollapsed && (
                <>
                  <div className="divide-y divide-red-100/50 dark:divide-red-500/10">
                {warnings.slice(0, 5).map((w, i) => (
                  <div key={i} className="px-3 py-2 hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors group">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                          {resolveMachineName(machines, w.machineId)}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums">
                        {w.timestamp ? new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <MetricTypeBadge metric={w.metric} />
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                            {w.warning || 'Threshold approaching'}
                          </span>
                        </div>
                      </div>
                      <SeverityBadge severity="warning" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 text-center border-t border-gray-100 dark:border-gray-700/50">
                <button className="text-[10px] font-medium text-gray-500 hover:text-red-600 transition-colors flex items-center justify-center gap-1 w-full">
                  View All Warnings <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              </>
              )}
            </Card>
          )}
        </div>
      )}

      <Recommendations data={recData} />

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Machine
        </button>
        <button onClick={refetch}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <button onClick={() => setBatchOpen(true)} disabled={selectedCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          <Shield className="w-3.5 h-3.5" /> Batch Actions {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button onClick={toggleSelectAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <CheckCircle className="w-3.5 h-3.5" /> {machines && selectedCount === machines.length ? 'Clear All' : 'Select All'}
        </button>
        {selectedCount > 0 && (
          <button onClick={clearSelection}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <X className="w-3.5 h-3.5" /> Clear Selection
          </button>
        )}
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
          {machines.map((m) => (
            <MachineCard
              key={m.id}
              machine={m}
              onDelete={handleDelete}
              onView={setSelectedMachine}
              selected={filteredSelectedIds.includes(m.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <AddMachineModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={refetch} />
      <HostDetailModal
        machine={selectedMachine}
        open={!!selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
      <BatchActionModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        machines={machines || []}
        selectedIds={filteredSelectedIds}
      />
    </div>
  );
};

// ─── Machine Card (Numeric-Dominant Redesign) ───────────────────

const ActionModal = ({ onClose, machineId, machineName }) => {
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const wsRef = useRef(null);

  const actions = [
    { key: 'reboot', label: 'Reboot', icon: '⟳', confirm: true },
    { key: 'check-updates', label: 'Check Updates', icon: '📦' },
    { key: 'update', label: 'Update Packages', icon: '⬆️' },
    { key: 'upgrade', label: 'Upgrade Packages', icon: '🚀', confirm: true },
    { key: 'upgrade-all', label: 'Upgrade All', icon: '🚀', confirm: true },
    { key: 'restart-docker', label: 'Restart Docker', icon: '🐳', confirm: true },
    { key: 'restart-ssh', label: 'Restart SSH', icon: '🔑', confirm: true },
    { key: 'service-status', label: 'Service Status', icon: '📋' },
  ];

  useEffect(() => () => { if (wsRef.current) wsRef.current.close(); }, []);

  const run = async (action) => {
    if (action.confirm && !window.confirm(`${action.label} on ${machineName}?`)) return;
    setRunning(action.key);
    setResult(null);

    const STREAMING_ACTIONS = ['check-updates', 'update', 'upgrade', 'upgrade-all', 'service-status'];

    if (STREAMING_ACTIONS.includes(action.key)) {
      setResult({ ok: true, msg: 'Connecting...\n' });
      try {
        const ws = new WebSocket(`${WS_BASE}/ws/action?machineId=${machineId}&action=${action.key}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setResult(prev => ({ ...prev, msg: prev.msg + 'Connected. Executing...\n' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'output') {
              setResult(prev => ({ ...prev, msg: prev.msg + data.data }));
            } else if (data.type === 'error') {
              setResult(prev => ({ ...prev, ok: false, msg: prev.msg + '\nError: ' + data.message }));
            } else if (data.type === 'finished') {
              setResult(prev => ({ ...prev, msg: prev.msg + `\n\n--- Finished (Exit Code: ${data.code}) ---` }));
              setRunning(null);
              ws.close();
            } else if (data.type === 'status') {
              setResult(prev => ({ ...prev, msg: prev.msg + `[Status] ${data.message}\n` }));
            }
          } catch (e) {
            console.error('WS Parse Error', e);
          }
        };

        ws.onerror = () => {
          setResult(prev => ({ ...prev, ok: false, msg: prev.msg + '\nWebSocket Error' }));
          setRunning(null);
        };

        ws.onclose = () => {
          setRunning(null);
        };
      } catch (e) {
        setResult({ ok: false, msg: 'Failed to connect: ' + e.message });
        setRunning(null);
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/machines/${machineId}/control`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.key }),
      });
      const data = await res.json();
      setResult(res.ok ? { ok: true, msg: data.stdout || 'Done' } : { ok: false, msg: data.error });
    } catch (e) { setResult({ ok: false, msg: e.message }); }
    setRunning(null);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Actions — {machineName}</h2>
            <p className="text-[11px] text-gray-400">Run privileged maintenance tasks with live output.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-3 p-4">
          <div className="space-y-1">
            {actions.map(a => (
              <button key={a.key} onClick={() => run(a)} disabled={running != null}
                className="flex items-center gap-2 w-full text-left text-xs px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <span className="text-sm">{a.icon}</span>
                <span className="flex-1">{running === a.key ? 'Running…' : a.label}</span>
              </button>
            ))}
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950/40 p-3 min-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Output</span>
              {result && (
                <button onClick={() => setResult(null)} className="text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
            {result ? (
              <pre className={`text-[11px] whitespace-pre-wrap font-mono ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>{result.msg}</pre>
            ) : (
              <p className="text-[11px] text-gray-400">Select an action to see real-time output here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BatchActionModal = ({ open, onClose, machines, selectedIds, onCompleted }) => {
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const toast = useToast();

  if (!open) return null;

  const actions = [
    { key: 'update', label: 'Update Packages', icon: '⬆️' },
    { key: 'upgrade', label: 'Upgrade Packages', icon: '🚀', confirm: true },
    { key: 'upgrade-all', label: 'Upgrade All', icon: '🚀', confirm: true },
    { key: 'reboot', label: 'Reboot', icon: '⟳', confirm: true },
    { key: 'restart-docker', label: 'Restart Docker', icon: '🐳', confirm: true },
    { key: 'restart-ssh', label: 'Restart SSH', icon: '🔑', confirm: true },
  ];

  const selectedMachines = (machines || []).filter(m => selectedIds.includes(m.id));
  const label = selectedMachines.length === 1 ? '1 Host' : `${selectedMachines.length} Hosts`;

  const run = async (action) => {
    if (!selectedIds.length) return;
    if (action.confirm && !window.confirm(`${action.label} on ${label}?`)) return;

    setRunning(action.key);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/machines/batch/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.key, machineIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
      toast.success(`Batch '${action.label}' completed`);
      onCompleted?.(data);
    } catch (e) {
      setResult({ error: e.message });
      toast.error(e.message);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Batch Actions — {label}</h2>
            <p className="text-[11px] text-gray-400">Run maintenance tasks on multiple hosts.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-3 p-4">
          <div className="space-y-1">
            {actions.map(a => (
              <button key={a.key} onClick={() => run(a)} disabled={running != null}
                className="flex items-center gap-2 w-full text-left text-xs px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <span className="text-sm">{a.icon}</span>
                <span className="flex-1">{running === a.key ? 'Running…' : a.label}</span>
              </button>
            ))}
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950/40 p-3 min-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Results</span>
              {result && (
                <button onClick={() => setResult(null)} className="text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
            {result?.error ? (
              <p className="text-[11px] text-red-600">{result.error}</p>
            ) : result?.results ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {result.missingIds?.length > 0 && (
                  <p className="text-[10px] text-amber-600">Missing IDs: {result.missingIds.join(', ')}</p>
                )}
                {result.results.map((r) => (
                  <div key={r.machineId} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 px-2.5 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{r.machineName || `#${r.machineId}`}</span>
                      <span className={`text-[10px] font-semibold ${r.ok ? 'text-emerald-600' : 'text-red-600'}`}>{r.ok ? 'Success' : 'Failed'}</span>
                    </div>
                    <pre className={`text-[10px] whitespace-pre-wrap font-mono ${r.ok ? 'text-emerald-700' : 'text-red-700'}`}>{r.error || r.stderr || r.stdout || 'No output'}</pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">Select an action to run it across selected hosts.</p>
            )}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-1">
            {selectedMachines.map(m => (
              <span key={m.id} className="text-[10px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {m.name || m.hostname}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Snapshot Manager ──────────────────────────────────────────

const SnapshotManager = ({ machineId }) => {
  const { data: machine } = useApi(machineId ? `/api/machines/${machineId}` : null);
  const proxmoxInfo = machine?.proxmox;
  
  const { data: snapshots, loading, refetch } = useApi(
    proxmoxInfo ? `/api/proxmox/snapshots/${proxmoxInfo.proxmox_host_id}/${proxmoxInfo.type}/${proxmoxInfo.vmid}` : null,
    10000
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [snapName, setSnapName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  if (!proxmoxInfo) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!snapName) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/proxmox/snapshots/${proxmoxInfo.proxmox_host_id}/${proxmoxInfo.type}/${proxmoxInfo.vmid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapname: snapName, description }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      toast.success('Snapshot creation started');
      setSnapName(''); setDescription(''); setCreateOpen(false);
      setTimeout(refetch, 2000);
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const handleRollback = async (snapname) => {
    if (!confirm(`Rollback to snapshot '${snapname}'? Current state will be lost.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/proxmox/snapshots/${proxmoxInfo.proxmox_host_id}/${proxmoxInfo.type}/${proxmoxInfo.vmid}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapname }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      toast.success('Rollback started');
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (snapname) => {
    if (!confirm(`Delete snapshot '${snapname}'?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/proxmox/snapshots/${proxmoxInfo.proxmox_host_id}/${proxmoxInfo.type}/${proxmoxInfo.vmid}/${snapname}`, {
        method: 'DELETE',
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      toast.success('Snapshot deletion started');
      setTimeout(refetch, 2000);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Card className="p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Snapshots ({proxmoxInfo.type.toUpperCase()} {proxmoxInfo.vmid})
          </h3>
          <p className="text-[10px] text-gray-400">Managed via {proxmoxInfo.proxmox_host_name}</p>
        </div>
        <button onClick={() => setCreateOpen(!createOpen)} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors font-medium">
          {createOpen ? 'Cancel' : '+ Create Snapshot'}
        </button>
      </div>

      {createOpen && (
        <form onSubmit={handleCreate} className="mb-4 bg-gray-50/50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="space-y-2">
            <input
              value={snapName} onChange={e => setSnapName(e.target.value)}
              placeholder="Snapshot Name" required
              className="w-full px-2 py-1.5 text-xs border rounded bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)" rows={2}
              className="w-full px-2 py-1.5 text-xs border rounded bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button type="submit" disabled={creating} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && !snapshots ? (
        <p className="text-[11px] text-gray-400 text-center py-2">Loading snapshots...</p>
      ) : !snapshots || snapshots.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic text-center py-2">No snapshots found.</p>
      ) : (
        <div className="space-y-1">
          {snapshots.map((snap) => (
            <div key={snap.name} className="flex items-start justify-between group p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{snap.name}</span>
                  {snap.snaptime && (
                    <span className="text-[9px] text-gray-400">
                      {new Date(snap.snaptime * 1000).toLocaleString()}
                    </span>
                  )}
                </div>
                {snap.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{snap.description}</p>}
                {snap.parent && <span className="text-[9px] text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded mt-1 inline-block">Parent: {snap.parent}</span>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleRollback(snap.name)} title="Rollback" className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 rounded transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(snap.name)} title="Delete" className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const HostDetailModal = ({ machine, open, onClose }) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const { data: metricsResp, loading: metricsLoading } = useApi(open && machine ? `/api/metrics/${machine.id}?limit=30` : null, open ? 10000 : null);
  const metricsData = metricsResp?.data ?? metricsResp ?? [];
  const [logsState, setLogsState] = useState({ loading: false, error: null, logs: [] });

  const refreshLogs = useCallback(async () => {
    if (!machine) return;
    setLogsState({ loading: true, error: null, logs: [] });
    try {
      const res = await fetch(`${API_BASE}/api/logs/search?machine_id=${machine.id}&limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogsState({ loading: false, error: null, logs: data.data ?? [] });
    } catch (err) {
      setLogsState({ loading: false, error: err.message, logs: [] });
    }
  }, [machine]);

  useEffect(() => {
    if (!open || !machine) return;
    refreshLogs();
  }, [open, machine, refreshLogs]);

  if (!open || !machine) return null;

  const memPct = machine.memory_total > 0 ? Math.round((machine.memory_used / machine.memory_total) * 100) : null;
  const diskPct = machine.disk_total > 0 ? Math.round((machine.disk_used / machine.disk_total) * 100) : null;
  const cpuPct = machine.cpu_usage != null ? Math.round(machine.cpu_usage) : null;
  const zfsPools = normalizeZfsPools(machine.zfs_pools);
  const hasZfs = machine.zfs_total != null && machine.zfs_total > 0;
  const zfsPct = hasZfs ? Math.round((machine.zfs_used / machine.zfs_total) * 100) : null;
  const hasZfsPools = zfsPools.length > 0;
  const isOffline = machine.status === 'offline';

  const levelColors = {
    error: 'bg-red-500/10 text-red-700 ring-red-500/20',
    warn: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
    warning: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
    info: 'bg-blue-500/10 text-blue-700 ring-blue-500/20',
    debug: 'bg-gray-500/10 text-gray-600 ring-gray-500/20',
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={machine.status} />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{machine.name || machine.hostname}</h2>
              <StatusBadge status={machine.status} />
            </div>
            <p className="text-[11px] text-gray-400 truncate">{machine.hostname} · {machine.user} · last seen {machine.last_seen ? new Date(machine.last_seen).toLocaleString() : 'never'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActionsOpen(true)} disabled={isOffline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
              <Shield className="w-3.5 h-3.5" /> Actions
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Live Metrics</h3>
                {isOffline && <span className="text-[10px] text-gray-400">Offline — showing last known values</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-center">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">CPU</p>
                  <p className="text-[22px] font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{cpuPct ?? '–'}%</p>
                  <ProgressBar value={cpuPct || 0} color="blue" size="xs" />
                </div>
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-center">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Memory</p>
                  <p className="text-[22px] font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{memPct ?? '–'}%</p>
                  <ProgressBar value={memPct || 0} color="violet" size="xs" />
                </div>
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-center">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Disk</p>
                  <p className="text-[22px] font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{diskPct ?? '–'}%</p>
                  <ProgressBar value={diskPct || 0} color="emerald" size="xs" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">CPU Trend</h4>
                  <div className="flex items-end gap-[2px] h-16">
                    {[...metricsData].reverse().slice(0, 30).map((m, i) => {
                      const pct = Math.max(1, Math.round(m.cpu_usage || 0));
                      const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-blue-500';
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className={`w-full ${barColor} rounded-t`} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Memory Trend</h4>
                  <div className="flex items-end gap-[2px] h-16">
                    {[...metricsData].reverse().slice(0, 30).map((m, i) => {
                      const pct = m.memory_total > 0 ? Math.max(1, Math.round((m.memory_used / m.memory_total) * 100)) : 0;
                      const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-violet-500';
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className={`w-full ${barColor} rounded-t`} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {metricsLoading && metricsData.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-3">Loading recent metrics…</p>
              )}
            </Card>

            <div className="flex flex-col gap-3">
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">System Details</h3>
                <div className="space-y-2 text-[11px] text-gray-500">
                  <div className="flex items-center justify-between"><span>Hostname</span><span className="font-mono text-gray-700 dark:text-gray-200">{machine.hostname}</span></div>
                  <div className="flex items-center justify-between"><span>User</span><span className="font-mono text-gray-700 dark:text-gray-200">{machine.user}</span></div>
                  <div className="flex items-center justify-between"><span>Load 1/5/15</span><span className="font-mono text-gray-700 dark:text-gray-200">{machine.load_1?.toFixed(2) ?? '–'} / {machine.load_5?.toFixed(2) ?? '–'} / {machine.load_15?.toFixed(2) ?? '–'}</span></div>
                  <div className="flex items-center justify-between"><span>Memory</span><span className="font-mono text-gray-700 dark:text-gray-200">{formatBytes(machine.memory_used)} / {formatBytes(machine.memory_total)}</span></div>
                  <div className="flex items-center justify-between"><span>Disk</span><span className="font-mono text-gray-700 dark:text-gray-200">{formatBytes(machine.disk_used)} / {formatBytes(machine.disk_total)}</span></div>
                  {hasZfs && (
                    <div className="flex items-center justify-between">
                      <span>ZFS</span>
                      <span className="font-mono text-gray-700 dark:text-gray-200">
                        {zfsPct}% · {formatZfsValue(machine.zfs_used)} / {formatZfsValue(machine.zfs_total)} · {machine.zfs_health}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
              {hasZfsPools && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">ZFS Pools</h3>
                  <div className="space-y-2 text-[11px] text-gray-500">
                    {zfsPools.map((pool) => (
                      <div key={pool.name} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-mono text-gray-700 dark:text-gray-200 truncate">{pool.name}</div>
                          <div className="text-[9px] text-gray-400">
                            {formatBytesFromBytes(pool.alloc)} / {formatBytesFromBytes(pool.size)}
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold ${zfsHealthColor(pool.health, isOffline)}`}>{pool.health}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <SnapshotManager machineId={machine.id} />
            </div>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Recent Logs</h3>
              <button
                onClick={refreshLogs}
                className="text-[10px] text-gray-400 hover:text-gray-600"
              >
                Refresh
              </button>
            </div>
            {logsState.error ? (
              <div className="text-[11px] text-red-600">Error loading logs: {logsState.error}</div>
            ) : logsState.loading && logsState.logs.length === 0 ? (
              <div className="text-[11px] text-gray-400">Loading logs…</div>
            ) : logsState.logs.length === 0 ? (
              <div className="text-[11px] text-gray-400">No logs for this host yet.</div>
            ) : (
              <div className="space-y-2">
                {logsState.logs.slice(0, 12).map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-[11px]">
                    <span className="text-gray-400 whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '–'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ring-1 ring-inset ${levelColors[log.level?.toLowerCase()] || 'bg-gray-500/10 text-gray-600 ring-gray-500/20'}`}>{log.level || '–'}</span>
                    <span className="text-gray-700 dark:text-gray-200 font-mono break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      {actionsOpen && (
        <ActionModal
          onClose={() => setActionsOpen(false)}
          machineId={machine.id}
          machineName={machine.name || machine.hostname}
        />
      )}
    </div>
  );
};

const MachineCard = ({ machine: m, onDelete, onView, selected, onSelect, selectable = true }) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const memPct = m.memory_total > 0 ? Math.round((m.memory_used / m.memory_total) * 100) : null;
  const diskPct = m.disk_total > 0 ? Math.round((m.disk_used / m.disk_total) * 100) : null;
  const cpuPct = m.cpu_usage != null ? Math.round(m.cpu_usage) : null;
  const zfsPools = normalizeZfsPools(m.zfs_pools);
  const hasZfsPools = zfsPools.length > 0;
  const hasZfs = m.zfs_total != null && m.zfs_total > 0;
  const zfsPct = hasZfs ? Math.round((m.zfs_used / m.zfs_total) * 100) : null;
  const hasLoad = m.load_1 != null && m.load_1 > 0;

  const isOffline = m.status === 'offline';

  const metricColor = (v, warn = 70, crit = 90) =>
    v == null ? 'text-gray-300' : isOffline ? 'text-gray-400' : v >= crit ? 'text-red-600' : v >= warn ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100';

  // zfsHealthColor helper defined globally

  return (
    <Card className="p-2.5 hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onSelect?.(m.id)}
              className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
              title="Select host"
            />
          )}
          <StatusDot status={m.status} />
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">{m.name || m.hostname}</h3>
            <p className="text-[9px] text-gray-400 truncate leading-tight">{m.hostname} · {m.user}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={m.status} />
          <button onClick={() => onDelete(m.id)}
            className="p-0.5 text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded hover:bg-red-50 dark:hover:bg-red-500/10"
            title="Delete"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Stale indicator for offline machines */}
      {isOffline && (cpuPct != null || memPct != null || diskPct != null) && (
        <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider text-center mb-1">⏸ Last Known Metrics</p>
      )}

      {/* Primary metrics — large numbers */}
      <div className={`grid grid-cols-3 gap-1 mb-1.5 ${isOffline ? 'opacity-50' : ''}`}>
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
      <div className={`grid grid-cols-3 gap-1 mb-2 ${isOffline ? 'opacity-50' : ''}`}>
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
        <div className={`grid gap-1.5 mb-2 ${hasZfs && hasLoad ? 'grid-cols-2' : 'grid-cols-1'} ${isOffline ? 'opacity-50' : ''}`}>
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
                <span className="flex items-center gap-1">
                  {hasZfsPools && <span className="text-[8px] text-gray-400">{zfsPools.length} pools</span>}
                  <span className={`text-[8px] font-bold ${zfsHealthColor(m.zfs_health, isOffline)}`}>{m.zfs_health}</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[11px] font-bold tabular-nums ${metricColor(zfsPct, 70, 85)}`}>{zfsPct}%</span>
                <span className="text-[9px] text-gray-400 tabular-nums">{formatZfsValue(m.zfs_used)}/{formatZfsValue(m.zfs_total)}</span>
              </div>
              <ProgressBar value={zfsPct || 0} color="emerald" size="xs" />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <span className={`text-[9px] flex items-center gap-0.5 ${isOffline ? 'text-gray-500 font-medium' : 'text-gray-400'}`}>
          <Clock className="w-2.5 h-2.5" />
          {isOffline ? 'Last seen ' : ''}{m.last_seen ? new Date(m.last_seen).toLocaleTimeString() : 'Never'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => onView?.(m)}
            className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-blue-50 dark:hover:bg-blue-500/10"
            title="View details"><Eye className="w-3 h-3" /></button>
          <button onClick={() => setActionsOpen(true)} disabled={isOffline}
            className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50"
            title="Actions"><Settings className="w-3 h-3" /></button>
        </div>
      </div>
      {actionsOpen && (
        <ActionModal
          onClose={() => setActionsOpen(false)}
          machineId={m.id}
          machineName={m.name || m.hostname}
        />
      )}
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
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Uptime — 30 Days</h3>
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

const EXPORT_FIELDS = [
  { key: 'cpu_usage', label: 'CPU Usage' },
  { key: 'memory_used', label: 'Memory Used' },
  { key: 'memory_total', label: 'Memory Total' },
  { key: 'disk_used', label: 'Disk Used' },
  { key: 'disk_total', label: 'Disk Total' },
  { key: 'load_1', label: 'Load 1m' },
  { key: 'load_5', label: 'Load 5m' },
  { key: 'load_15', label: 'Load 15m' },
  { key: 'zfs_used', label: 'ZFS Used' },
  { key: 'zfs_total', label: 'ZFS Total' },
  { key: 'zfs_health', label: 'ZFS Health' },
  { key: 'zfs_pools', label: 'ZFS Pools' },
];

const MetricsExportModal = ({ open, onClose, machines, defaultMachineIds }) => {
  const toast = useToast();
  const [format, setFormat] = useState('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMachineIds, setSelectedMachineIds] = useState(defaultMachineIds || []);
  const [selectedFields, setSelectedFields] = useState(EXPORT_FIELDS.map(f => f.key));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedMachineIds(defaultMachineIds || []);
  }, [open, defaultMachineIds]);

  if (!open) return null;

  const toggleMachine = (id) => {
    setSelectedMachineIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleField = (key) => {
    setSelectedFields(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]));
  };

  const toIsoOrNull = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const handleExport = async () => {
    if (!selectedMachineIds.length) {
      toast.error('Select at least one machine to export.');
      return;
    }
    if (!selectedFields.length) {
      toast.error('Select at least one field to export.');
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.set('machineIds', selectedMachineIds.join(','));
      params.set('format', format);
      params.set('metrics', selectedFields.join(','));
      const start = toIsoOrNull(dateFrom);
      const end = toIsoOrNull(dateTo);
      if (start) params.set('start', start);
      if (end) params.set('end', end);

      const res = await fetch(`${API_BASE}/api/metrics/export?${params.toString()}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      let filename = `metrics_export.${format}`;
      const disposition = res.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export generated.');
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export Metrics Data</h2>
            <p className="text-[11px] text-gray-400">Select format, date range, machines, and fields.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Date Range</label>
              <div className="grid grid-cols-1 gap-2">
                <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" />
                <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Machines</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(machines || []).map(m => (
                <label key={m.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={selectedMachineIds.includes(m.id)} onChange={() => toggleMachine(m.id)} />
                  <span>{m.name || m.hostname}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Fields</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXPORT_FIELDS.map(field => (
                <label key={field.key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => toggleField(field.key)} />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={handleExport} disabled={submitting}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Exporting…' : 'Export Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricsTab = () => {
  const { data: machines } = useApi('/api/machines', 10000);
  const [selectedId, setSelectedId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;
  const { data: metrics, loading } = useApi(effectiveId ? `/api/metrics/${effectiveId}?limit=50` : null, effectiveId ? 10000 : null);
  const metricsData = metrics?.data ?? metrics ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Historical Metrics</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {machines?.length > 0 && (
            <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full sm:w-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
            </select>
          )}
          <button onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Database className="w-3.5 h-3.5" /> Export Data
          </button>
        </div>
      </div>

      {effectiveId && <UptimeChart machineId={effectiveId} />}

      <MetricsExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        machines={machines || []}
        defaultMachineIds={effectiveId ? [effectiveId] : []}
      />

      {loading && !metricsData.length ? <Spinner /> : !metricsData.length ? (
        <Card className="p-6"><EmptyState icon={BarChart3} title="No metrics yet" description="Metrics will appear after the first collection cycle." /></Card>
      ) : (
        <>
          {/* CPU + Memory side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">CPU Usage</h3>
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
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Memory Usage</h3>
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
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
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

// ─── Log Aggregator ─────────────────────────────────────────────

const LogAggregator = () => {
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

  const toLocalInput = (d) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  const toIsoOrNull = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const applyRange = (hours) => {
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    setDateFrom(toLocalInput(from));
    setDateTo(toLocalInput(now));
    setPage(1);
  };

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (machineId) params.set('machine_id', machineId);
      if (level) params.set('level', level);
      const fromIso = toIsoOrNull(dateFrom);
      const toIso = toIsoOrNull(dateTo);
      if (fromIso) params.set('date_from', fromIso);
      if (toIso) params.set('date_to', toIso);
      params.set('page', p); params.set('limit', '50');
      const res = await fetch(`${API_BASE}/api/logs/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResults(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [keyword, machineId, level, dateFrom, dateTo, page]);

  useEffect(() => { fetchLogs(page); }, [page, fetchLogs]);

  const handleSearch = (e) => { e?.preventDefault(); setPage(1); fetchLogs(1); };
  const handleReset = () => {
    setKeyword('');
    setMachineId('');
    setLevel('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Log Aggregator</h2>
        {pagination && (
          <span className="text-xs text-gray-400">{pagination.total} Result{pagination.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      <Card className="p-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search log messages…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <Terminal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              <option value="">All Hosts</option>
              {(machines ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.hostname}</option>
              ))}
            </select>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              <option value="">All Severities</option>
              {(levels ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" /> Search
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-[10px] text-gray-500 flex flex-col gap-1">
              From
              <input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
              />
            </label>
            <label className="text-[10px] text-gray-500 flex flex-col gap-1">
              To
              <input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
              />
            </label>
            <div className="flex flex-wrap items-end gap-1 text-[10px]">
              <span className="text-gray-400">Quick range:</span>
              <button type="button" onClick={() => applyRange(1)} className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-300">1h</button>
              <button type="button" onClick={() => applyRange(6)} className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-300">6h</button>
              <button type="button" onClick={() => applyRange(24)} className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-300">24h</button>
              <button type="button" onClick={() => applyRange(168)} className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-300">7d</button>
            </div>
          </div>
        </form>
      </Card>

      {error ? (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs">Error: {error}</p>
            <button onClick={() => fetchLogs(page)} className="ml-auto text-xs underline">Retry</button>
          </div>
        </Card>
      ) : loading && !logs.length ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Terminal} title="No Logs Found" description="Adjust the filters to widen the search." /></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/80 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2 w-36">Timestamp</th>
                    <th className="px-3 py-2 w-16">Level</th>
                    <th className="px-3 py-2 w-32">Host</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '–'}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ring-inset ${levelColors[log.level?.toLowerCase()] || 'bg-gray-500/10 text-gray-600 ring-gray-500/20'}`}>
                          {log.level || '–'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 truncate max-w-[7rem]">
                        {log.machine_name || log.machine_hostname || `#${log.machine_id}`}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 font-mono break-all">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500">{pagination.page}/{pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Logs Tab ───────────────────────────────────────────────────

const LogsTab = () => (
  <div className="space-y-4">
    <LogAggregator />
  </div>
);

// ─── Containers Tab ─────────────────────────────────────────────

const ContainersTab = () => {
  const { data: machines } = useApi('/api/machines', 15000);
  const [selectedId, setSelectedId] = useState(null);
  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;
  const { data: containers, loading: directLoading, refetch: refetchDirect } = useApi(effectiveId ? `/api/containers/${effectiveId}` : null, effectiveId ? 10000 : null);
  const { data: nestedData, loading: nestedLoading, refetch: refetchNested } = useApi('/api/containers/nested', 10000);
  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const [collapsedHosts, setCollapsedHosts] = useState({});
  const [collapsedLxcs, setCollapsedLxcs] = useState({});
  const toast = useToast();

  const refetch = useCallback(() => { refetchDirect(); refetchNested(); }, [refetchDirect, refetchNested]);

  const containerData = containers ?? [];
  const nestedTree = nestedData ?? [];

  const toggleHost = (id) => setCollapsedHosts(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLxc = (key) => setCollapsedLxcs(prev => ({ ...prev, [key]: !prev[key] }));

  const updatePolicy = async (containerId, maxRetries, gracePeriod) => {
    await fetch(`${API_BASE}/api/containers/policy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId, maxRetries, gracePeriod }),
    });
    toast.success('Policy updated');
    refetch();
  };

  const renderContainer = (c) => (
    <Card key={c.id} className="overflow-hidden">
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusDot status={c.state} />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.name}</h4>
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
  );

  // Direct containers for currently selected machine
  // We exclude LXC/VM entries because they are handled in the Proxmox tree
  const directContainers = containerData.filter(c => !c.source_type || c.source_type === 'direct');

  // Check if we have any nested data (Proxmox hosts with LXCs)
  const hasProxmoxData = nestedTree.length > 0;
  const loading = directLoading && nestedLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Containers</h2>
        {machines?.length > 0 && (
          <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full sm:w-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
          </select>
        )}
      </div>

      {loading && !containerData.length && !nestedTree.length ? <Spinner /> : (
        <div className="space-y-4">
          {/* Proxmox Nested View (Highest Priority for Layout) */}
          {hasProxmoxData && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Proxmox Infrastructure</h3>
              {nestedTree.map(host => {
                const hostLxcs = host.lxc_containers || [];
                if (hostLxcs.length === 0) return null;

                const hostCollapsed = collapsedHosts[host.id];

                return (
                  <Card key={host.id} className="overflow-hidden">
                    {/* Proxmox Host Header */}
                    <button
                      onClick={() => toggleHost(host.id)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 bg-gray-50/80 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-colors text-left"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${hostCollapsed ? '-rotate-90' : ''}`} />
                      <Server className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{host.name}</span>
                        <span className="text-[10px] text-gray-400 ml-2">{host.node_name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {hostLxcs.length} LXC Container{hostLxcs.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {!hostCollapsed && (
                      <div className="divide-y divide-gray-100">
                        {hostLxcs.map(lxc => {
                          const lxcKey = `${host.id}-${lxc.vmid}`;
                          const lxcCollapsed = collapsedLxcs[lxcKey];
                          const dockerContainers = lxc.docker_containers || [];
                          const dockerCount = dockerContainers.length;

                          return (
                            <div key={lxcKey}>
                              {/* LXC Container Header */}
                              <button
                                onClick={() => toggleLxc(lxcKey)}
                                className="w-full flex items-center gap-2.5 pl-10 pr-4 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors text-left"
                              >
                                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${lxcCollapsed ? '-rotate-90' : ''}`} />
                                <Box className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{lxc.name || `CT ${lxc.vmid}`}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-cyan-100 text-cyan-700">LXC {lxc.vmid}</span>
                                  <StatusBadge status={lxc.status} />
                                </div>
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {dockerCount > 0 ? `${dockerCount} nested container${dockerCount !== 1 ? 's' : ''}` : 'No nested Docker'}
                                </span>
                              </button>

                              {/* Docker Containers Inside LXC */}
                              {!lxcCollapsed && dockerCount > 0 && (
                                <div className="pl-16 pr-4 pb-3 space-y-2 mt-1">
                                  {dockerContainers.map(renderContainer)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Direct Docker containers (not from LXC) */}
          {directContainers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Standalone Docker Containers</h3>
              {directContainers.map(renderContainer)}
            </div>
          )}

          {/* Empty state */}
          {directContainers.length === 0 && !hasProxmoxData && (
            <Card className="p-6"><EmptyState icon={Box} title="No containers found" description="Docker containers will appear here after collection." /></Card>
          )}
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

// ─── Alert Profiles Manager ──────────────────────────────────────

const AlertProfileModal = ({ open, onClose, machines, onSave }) => {
  const [form, setForm] = useState({
    name: '', target_type: 'global', target_id: '',
    metric: 'cpu', condition: '>', threshold: '', duration: 0, severity: 'warning'
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setErr('');
    try {
      const payload = { ...form, threshold: Number(form.threshold), duration: Number(form.duration) };
      if (payload.target_type === 'global') payload.target_id = null;
      
      const res = await fetch(`${API_BASE}/api/alerts/profiles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      toast.success('Profile created');
      onSave(); onClose(); setForm({ name: '', target_type: 'global', target_id: '', metric: 'cpu', condition: '>', threshold: '', duration: 0, severity: 'warning' });
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-lg p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Create Alert Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. High CPU on Database"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Target</label>
              <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800">
                <option value="global">All Machines</option>
                <option value="machine">Specific Machine</option>
              </select>
            </div>
            {form.target_type === 'machine' && (
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Machine</label>
                <select value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800">
                  <option value="">Select Machine...</option>
                  {(machines || []).map(m => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Metric</label>
              <select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800">
                <option value="cpu">CPU Usage (%)</option>
                <option value="memory">Memory (%)</option>
                <option value="disk">Disk (%)</option>
                <option value="load_1">Load (1m)</option>
                <option value="load_5">Load (5m)</option>
                <option value="load_15">Load (15m)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800">
                <option value=">">&gt; (Greater)</option>
                <option value=">=">&ge; (Greater/Eq)</option>
                <option value="<">&lt; (Less)</option>
                <option value="<=">&le; (Less/Eq)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Threshold</label>
              <input type="number" step="0.1" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Duration (min)</label>
              <input type="number" min="0" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Create Profile</button>
          </div>
        </form>
      </Card>
    </div>
  );
};

const AlertProfilesManager = () => {
  const { data: profiles, loading, refetch } = useApi('/api/alerts/profiles');
  const { data: machines } = useApi('/api/machines');
  const [showAdd, setShowAdd] = useState(false);
  const toast = useToast();

  const handleToggle = async (p) => {
    try {
      await fetch(`${API_BASE}/api/alerts/profiles/${p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !p.enabled }),
      });
      refetch();
    } catch { toast.error('Update failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this profile?')) return;
    try { await fetch(`${API_BASE}/api/alerts/profiles/${id}`, { method: 'DELETE' }); refetch(); toast.success('Profile deleted'); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alert Profiles</h3>
          <p className="text-xs text-gray-500">Define custom thresholds for specific machines or global monitoring.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Create Profile
        </button>
      </div>

      {loading && !profiles ? <div className="text-xs text-gray-400 py-2">Loading...</div> : (!profiles || profiles.length === 0) ? (
        <div className="text-xs text-gray-400 py-4 text-center italic bg-gray-50 dark:bg-gray-800/30 rounded-lg">No alert profiles defined. Using system defaults.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500">
                <th className="py-2 pl-1">Status</th>
                <th className="py-2">Name</th>
                <th className="py-2">Condition</th>
                <th className="py-2">Scope</th>
                <th className="py-2 text-right pr-1">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {profiles.map(p => (
                <tr key={p.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="py-2 pl-1 w-10">
                    <button onClick={() => handleToggle(p)} className={`w-8 h-4 rounded-full relative transition-colors ${p.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${p.enabled ? 'translate-x-4' : ''}`} />
                    </button>
                  </td>
                  <td className="py-2 font-medium text-gray-700 dark:text-gray-200">
                    {p.name}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <SeverityBadge severity={p.severity} />
                      {p.duration > 0 && <span className="text-[9px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">For {p.duration}m</span>}
                    </div>
                  </td>
                  <td className="py-2">
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                      {p.metric} {p.condition} {p.threshold}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {p.target_type === 'global' ? (
                      <span className="flex items-center gap-1"><Server className="w-3 h-3" /> All Machines</span>
                    ) : (
                      <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {resolveMachineName(machines, p.target_id)}</span>
                    )}
                  </td>
                  <td className="py-2 text-right pr-1">
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AlertProfileModal open={showAdd} onClose={() => setShowAdd(false)} machines={machines} onSave={refetch} />
    </Card>
  );
};

// ─── Alerts Tab ─────────────────────────────────────────────────

const AlertsTab = () => {
  const { data: machines } = useApi('/api/machines', 15000);
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
      <AlertProfilesManager />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Anomalies & Forecasts</h2>
        <button onClick={triggerDetection} disabled={detecting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
          <Zap className={`w-3.5 h-3.5 ${detecting ? 'animate-pulse' : ''}`} /> {detecting ? 'Detecting…' : 'Run Detection'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Anomalies */}
        <div>
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Anomalies</h3>
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
                        <MetricTypeBadge metric={a.metric || a.type || 'Anomaly'} />
                        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">{resolveMachineName(machines, a.machine_id)}</span>
                        <SeverityBadge severity={a.severity || 'warning'} />
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        {a.message || <>Value: <span className="font-mono font-semibold">{formatAnomalyValue(a.value)}</span></>}
                      </p>
                      {a.detected_at && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{new Date(a.detected_at).toLocaleString()}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Forecasts */}
        <div>
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Forecasts</h3>
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
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{f.metric || 'Resource'}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{resolveMachineName(machines, f.machineId)}</span>
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

// ─── Terminal Toolbar (Mobile) ──────────────────────────────────

const TerminalToolbar = ({ onKey }) => {
  const keys = [
    { label: 'Esc', key: '\x1b' },
    { label: 'Tab', key: '\t' },
    { label: '/', key: '/' },
    { label: '-', key: '-' },
    { label: 'Home', key: '\x1b[H' },
    { label: 'End', key: '\x1b[F' },
    { label: 'PgUp', key: '\x1b[5~' },
    { label: 'PgDn', key: '\x1b[6~' },
    { label: '↑', key: '\x1b[A' },
    { label: '↓', key: '\x1b[B' },
    { label: '←', key: '\x1b[D' },
    { label: '→', key: '\x1b[C' },
    { label: 'Ctrl+C', key: '\x03' },
    { label: 'Ctrl+D', key: '\x04' },
    { label: 'Ctrl+Z', key: '\x1a' },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1.5 px-2 bg-slate-800 border-t border-slate-700">
      {keys.map((k) => (
        <button
          key={k.label}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent focus loss from terminal
            onKey(k.key);
          }}
          className="shrink-0 px-2 py-1.5 min-w-[32px] bg-slate-700 text-gray-200 rounded text-[10px] font-mono font-medium hover:bg-slate-600 active:bg-blue-600 transition-colors select-none"
        >
          {k.label}
        </button>
      ))}
    </div>
  );
};

// ─── Terminal Tab ───────────────────────────────────────────────

const TerminalTab = () => {
  const { data: machines } = useApi('/api/machines');
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const termRef = useRef(null);
  const termContainerRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRetryRef = useRef(0);
  const wsRetryTimerRef = useRef(null);
  const termReadyRef = useRef(false);
  const manualCloseRef = useRef(false);
  const activeMachineRef = useRef(null);

  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    if (wsRetryTimerRef.current) {
      clearTimeout(wsRetryTimerRef.current);
      wsRetryTimerRef.current = null;
    }
    wsRetryRef.current = 0;
    termReadyRef.current = false;
    activeMachineRef.current = null;

    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (termRef.current) {
      try { termRef.current.dispose(); } catch (e) { console.warn('Term dispose error', e); }
      termRef.current = null;
    }
    fitAddonRef.current = null;
    setConnected(false);
    setError(null);
  }, []);

  const safeFit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current || !termContainerRef.current) return;

    const container = termContainerRef.current;
    
    // Safety check for visibility and dimensions
    if (!container || container.clientWidth === 0 || container.clientHeight === 0 || !container.isConnected) {
      return;
    }

    // Double-check xterm's internal viewport
    // xterm.js can sometimes throw if the char measure element hasn't been rendered yet
    if (!termRef.current.element || termRef.current.element.clientWidth === 0) {
      return;
    }

    try {
      fitAddonRef.current.fit();
      
      // Mobile/scaling fix: Ensure minimum usable dimensions
      let cols = termRef.current.cols;
      let rows = termRef.current.rows;

      // Enforce minimums (e.g. for mobile) but don't force horizontal scroll unless necessary
      const minCols = 20; // 40 was too wide for some small screens
      const minRows = 5;

      if (cols < minCols || rows < minRows) {
        cols = Math.max(minCols, cols);
        rows = Math.max(minRows, rows);
        termRef.current.resize(cols, rows);
      }
      // No need to manually send WS here; term.resize() triggers onResize, which sends it.
      // If fit() didn't change size, onResize won't fire, but that's correct (no change).
    } catch (e) {
      console.warn('[Terminal] Fit failed', e);
    }
  }, []);

  const startWebSocket = useCallback((machineId) => {
    if (!machineId || !termReadyRef.current || !termRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (wsRetryTimerRef.current) {
      clearTimeout(wsRetryTimerRef.current);
      wsRetryTimerRef.current = null;
    }

    const ws = new WebSocket(`${WS_BASE}/ws/terminal?machineId=${machineId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      wsRetryRef.current = 0;
      setError(null);
    };

    ws.onmessage = async (event) => {
      let data = event.data;
      if (data instanceof Blob) {
        data = await data.text();
      }

      if (typeof data === 'string' && data.startsWith('{"type":')) {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'connected' || (msg.type === 'status' && msg.message === 'connected')) {
            console.log('[Terminal] Connected to shell');
            setConnected(true);
            termRef.current?.clear();
            requestAnimationFrame(() => setTimeout(safeFit, 50));
            return;
          }
          if (msg.type === 'error') {
            console.error('[Terminal] Server error:', msg.message);
            setError(msg.message);
            termRef.current?.write(`\r\n\x1b[1;31mError: ${msg.message}\x1b[0m\r\n`);
            return;
          }
          if (msg.type === 'output' && msg.data) {
            const bytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
            termRef.current?.write(bytes);
            return;
          }
        } catch (e) { console.warn('[Terminal] JSON parse error', e); }
      }
      termRef.current?.write(data);
    };

    ws.onclose = () => {
      setConnected(false);
      termRef.current?.write('\r\n\x1b[1;33mDisconnected.\x1b[0m\r\n');

      if (manualCloseRef.current || activeMachineRef.current !== machineId || !termRef.current) {
        return;
      }

      const nextAttempt = wsRetryRef.current + 1;
      const maxRetries = 5;
      if (nextAttempt > maxRetries) {
        setError('WebSocket connection failed');
        return;
      }

      const delay = Math.min(1000 * 2 ** wsRetryRef.current, 8000);
      wsRetryRef.current = nextAttempt;
      termRef.current?.write(`\r\n\x1b[1;33mReconnecting in ${Math.round(delay / 100) / 10}s...\x1b[0m\r\n`);
      wsRetryTimerRef.current = setTimeout(() => startWebSocket(machineId), delay);
    };

    ws.onerror = () => {
      if (!manualCloseRef.current) {
        setError('WebSocket connection failed');
      }
    };
  }, [safeFit]);

  const connect = useCallback(async (machineId) => {
    disconnect();
    if (!machineId) return;
    manualCloseRef.current = false;
    wsRetryRef.current = 0;
    termReadyRef.current = false;
    activeMachineRef.current = machineId;
    setError(null);

    const { Terminal: XTerminal } = await import('xterm');
    const { FitAddon } = await import('xterm-addon-fit');
    await import('xterm/css/xterm.css');

    const term = new XTerminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: window.innerWidth < 768 ? 11 : 13,
      allowProposedApi: true,
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

    // Mobile helper: handle touch move to prevent scroll propagation if needed
    // But xterm handles this well usually.

    if (termContainerRef.current) {
      termContainerRef.current.innerHTML = '';
      
      // Ensure container has dimensions before opening
      const checkDimensions = () => {
        if (!termRef.current) return; // Term was disposed
        if (termContainerRef.current && termContainerRef.current.clientWidth > 0 && termContainerRef.current.clientHeight > 0) {
          try {
            term.open(termContainerRef.current);
            termReadyRef.current = true;
            startWebSocket(machineId);
            requestAnimationFrame(() => setTimeout(safeFit, 100));
          } catch (e) {
            console.error('[Terminal] Open failed', e);
          }
        } else {
          // Retry briefly if container not yet ready (e.g. animation/layout shift)
          if (termRef.current === term) {
            setTimeout(checkDimensions, 50);
          }
        }
      };
      
      checkDimensions();
    }

    term.write('\x1b[1;34mConnecting…\x1b[0m\r\n');

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
  }, [disconnect, safeFit, startWebSocket]);

  useEffect(() => {
    let ro = null;
    let rafId = null;

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (termRef.current) {
          // Adjust font size dynamically for mobile readability vs desktop density
          const isMobile = window.innerWidth < 768;
          const newFontSize = isMobile ? 12 : 13;
          if (termRef.current.options.fontSize !== newFontSize) {
            termRef.current.options.fontSize = newFontSize;
          }
        }
        safeFit();
      });
    };

    // Use ResizeObserver for accurate container sizing
    if (termContainerRef.current) {
      ro = new ResizeObserver(handleResize);
      ro.observe(termContainerRef.current);
    }

    // Window resize is still useful for font-size updates (media queries)
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [safeFit]);

  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">SSH Terminal</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {machines?.length > 0 && (
            <select value={effectiveId || ''} onChange={(e) => { setSelectedId(Number(e.target.value)); disconnect(); }}
              className="flex-1 sm:flex-none sm:w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
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

      <Card className="overflow-hidden bg-[#0f172a]">
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
        <div className="relative h-[60vh] sm:h-[500px] min-h-[300px]">
          {!connected && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10 pointer-events-none">
              <div className="text-center space-y-2">
                <Terminal className="w-8 h-8 mx-auto text-gray-600 dark:text-gray-400" />
                <p className="text-xs">Select a machine and click <strong>Connect</strong></p>
              </div>
            </div>
          )}
          <div ref={termContainerRef} className="w-full h-full overflow-hidden" style={{ padding: '4px' }} />
        </div>
        {connected && (
          <div className="border-t border-slate-800">
            <TerminalToolbar onKey={(k) => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input', data: k }));
                termRef.current?.focus();
              }
            }} />
          </div>
        )}
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alert Webhooks</h3>
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
                    className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
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
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${form.events.includes(at.value) ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-violet-200'}`}>
                      {at.label}
                    </button>
                  ))}
                </div></div>
              {err && <p className="text-[10px] text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="px-3 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-medium hover:bg-violet-700 disabled:opacity-50">{submitting ? 'Adding…' : 'Add'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setErr(''); }} className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-[10px] font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              </div>
            </form>
          )}

          {loading ? <div className="text-xs text-gray-400">Loading…</div> : webhookList.length === 0 ? (
            <div className="text-xs text-gray-400 py-3 text-center">No webhooks configured.</div>
          ) : (
            <div className="space-y-1.5">
              {webhookList.map(wh => (
                <div key={wh.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${wh.enabled ? 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60'}`}>
                  <StatusDot status={wh.enabled ? 'online' : 'offline'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{wh.name}</span>
                      <span className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 py-0.5 rounded uppercase">{wh.type}</span>
                    </div>
                    {wh.events?.length > 0 && <div className="flex flex-wrap gap-0.5 mt-0.5">{wh.events.map(e => <span key={e} className="text-[9px] bg-violet-50 text-violet-600 px-1 py-0.5 rounded">{e}</span>)}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id} className="p-1 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-600 transition-colors" title="Test">
                      <Zap className={`w-3.5 h-3.5 ${testing === wh.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button onClick={() => handleToggle(wh)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors" title={wh.enabled ? 'Disable' : 'Enable'}>
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
      <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">{label}</span>
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
      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Settings</h2>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-500/20 rounded-lg shrink-0"><RefreshCw className="w-5 h-5 text-blue-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Collection</h3>
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
          <div className="p-2 bg-amber-50 dark:bg-amber-500/20 rounded-lg shrink-0"><Bell className="w-5 h-5 text-amber-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
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
          <div className="p-2 bg-emerald-50 dark:bg-emerald-500/20 rounded-lg shrink-0"><Shield className="w-5 h-5 text-emerald-600" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Setup Help</h3>
            <div className="mt-2 space-y-3 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-0.5">1. Configure SSH Keys</h4>
                <div className="bg-slate-900 text-green-400 text-[11px] font-mono rounded-lg p-2.5 overflow-x-auto leading-relaxed">
                  <p>ssh-keygen -t ed25519 -C "pulse-monitor"</p>
                  <p>ssh-copy-id -i ~/.ssh/id_ed25519.pub user@host</p>
                  <p>export SSH_KEY_PATH=~/.ssh/id_ed25519</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-0.5">2. Add Machines</h4>
                <p className="text-[11px] text-gray-500">Dashboard → Add Machine. Enter hostname/IP and SSH user.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-0.5">Troubleshooting</h4>
                <ul className="text-[11px] text-gray-500 list-disc list-inside space-y-0.5">
                  <li>Offline? Verify: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ssh user@host "echo ok"</code></li>
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
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0"><Info className="w-5 h-5 text-gray-500" /></div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">About Pulse</h3>
            <p className="text-xs text-gray-500 mt-0.5">Lightweight infrastructure monitoring via SSH. Metrics, containers, anomaly detection, auto-healing.</p>
            <p className="text-[10px] text-gray-400 mt-1">v1.0.0</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── Proxmox LXC Resource List ──────────────────────────────────

const ProxmoxLxcList = ({ lxcResources }) => {
  return (
    lxcResources.length === 0 ? (
      <Card className="p-6"><EmptyState icon={Box} title="No LXC Containers" description="LXC containers will appear here once discovered from your Proxmox hosts." /></Card>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
        {lxcResources.map(r => <ResourceCard key={`${r.proxmox_host_id}-${r.vmid}`} r={r} />)}
      </div>
    )
  );
};

// ─── Proxmox Tab ────────────────────────────────────────────────

const formatUptime = (s) => {
  if (!s) return '–';
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

const formatNet = (bytes) => {
  if (!bytes) return '–';
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

const ResourceCard = ({ r }) => {
  const memPct = r.memory_total > 0 ? Math.round((r.memory_used / r.memory_total) * 100) : null;
  const diskPct = r.disk_total > 0 ? Math.round((r.disk_used / r.disk_total) * 100) : null;
  const isRunning = r.status === 'running';
  const metricColor = (v, warn = 70, crit = 90) =>
    v == null ? 'text-gray-300' : !isRunning ? 'text-gray-400' : v >= crit ? 'text-red-600' : v >= warn ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100';

  return (
    <Card className="p-2.5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusDot status={r.status === 'running' ? 'online' : 'offline'} />
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">{r.name}</h3>
            <p className="text-[9px] text-gray-400 truncate leading-tight">
              {r.type === 'lxc' ? 'LXC' : 'VM'} {r.vmid} · {r.host_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${r.type === 'lxc' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}`}>
            {r.type === 'lxc' ? 'LXC' : 'VM'}
          </span>
          <StatusBadge status={r.status === 'running' ? 'running' : r.status === 'stopped' ? 'exited' : r.status} />
        </div>
      </div>

      {isRunning && (
        <>
          <div className={`grid grid-cols-3 gap-1 mb-1.5`}>
            <div className="text-center">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">CPU</p>
              <p className={`text-[22px] font-extrabold tabular-nums leading-none ${metricColor(r.cpu_usage)}`}>
                {r.cpu_usage != null ? Math.round(r.cpu_usage) : '–'}<span className="text-[10px] font-semibold">%</span>
              </p>
              <ProgressBar value={r.cpu_usage || 0} color="blue" size="xs" />
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
          <div className="grid grid-cols-3 gap-1 mb-2">
            <p className="text-[9px] text-gray-400 tabular-nums text-center leading-none">
              {r.cpu_count ? `${r.cpu_count} core${r.cpu_count > 1 ? 's' : ''}` : '\u00A0'}
            </p>
            <p className="text-[9px] text-gray-400 tabular-nums text-center leading-none">
              {r.memory_total > 0 ? `${formatBytes(r.memory_used)}/${formatBytes(r.memory_total)}` : '\u00A0'}
            </p>
            <p className="text-[9px] text-gray-400 tabular-nums text-center leading-none">
              {r.disk_total > 0 ? `${formatBytes(r.disk_used)}/${formatBytes(r.disk_total)}` : '\u00A0'}
            </p>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" /> {isRunning ? `up ${formatUptime(r.uptime)}` : r.status}
        </span>
        {isRunning && (
          <span className="text-[9px] text-gray-400">
            ↓{formatNet(r.netin)} ↑{formatNet(r.netout)}
          </span>
        )}
      </div>
    </Card>
  );
};

const ProxmoxTab = () => {
  const { data: hosts, refetch: refetchHosts } = useApi('/api/proxmox/hosts', 15000);
  const { data: resources, loading: resLoading, refetch: refetchRes } = useApi('/api/proxmox/resources', 10000);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', api_url: '', node_name: 'pve', token_id: '', token_secret: '' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [collecting, setCollecting] = useState(false);
  const toast = useToast();

  const hostList = hosts ?? [];
  const resList = resources ?? [];

  const lxcResources = resList.filter(r => r.type === 'lxc');
  const qemuResources = resList.filter(r => r.type === 'qemu');
  const runningCount = resList.filter(r => r.status === 'running').length;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.api_url) { setErr('Name and API URL are required'); return; }
    setSubmitting(true); setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/proxmox/hosts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      setForm({ name: '', api_url: '', node_name: 'pve', token_id: '', token_secret: '' });
      setShowAdd(false); toast.success('Proxmox host added'); refetchHosts(); refetchRes();
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Proxmox host and all its data?')) return;
    await fetch(`${API_BASE}/api/proxmox/hosts/${id}`, { method: 'DELETE' });
    toast.success('Host deleted'); refetchHosts(); refetchRes();
  };

  const triggerCollect = async () => {
    setCollecting(true);
    try { await fetch(`${API_BASE}/api/proxmox/collect`, { method: 'POST' }); toast.success('Proxmox collection complete'); refetchRes(); }
    catch (e) { toast.error(e.message); }
    finally { setCollecting(false); }
  };

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-px bg-gray-200/60 rounded-xl overflow-hidden border border-gray-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {[
          { label: 'Hosts', value: hostList.length, Icon: Server },
          { label: 'LXC', value: lxcResources.length, Icon: Box },
          { label: 'VMs', value: qemuResources.length, Icon: Database },
          { label: 'Running', value: runningCount, sub: `of ${resList.length}`, color: runningCount === resList.length ? 'text-emerald-600' : 'text-amber-600', Icon: Activity },
        ].map(({ label, value, sub, color, Icon }) => (
          <div key={label} className="bg-white dark:bg-gray-900 px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider leading-none">{label}</p>
              <p className={`text-base sm:text-lg font-bold leading-tight tabular-nums ${color || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
              {sub && <p className="text-[9px] text-gray-400 leading-none mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Proxmox Host
        </button>
        <button onClick={triggerCollect} disabled={collecting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`} /> {collecting ? 'Collecting…' : 'Collect Now'}
        </button>
      </div>

      {/* Add host form */}
      {showAdd && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Proxmox Host</h3>
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Name *</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Zeus"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">API URL *</label>
                <input value={form.api_url} onChange={(e) => setForm(f => ({ ...f, api_url: e.target.value }))} placeholder="https://192.168.96.11:8006"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Node Name</label>
                <input value={form.node_name} onChange={(e) => setForm(f => ({ ...f, node_name: e.target.value }))} placeholder="pve"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">API Token ID</label>
                <input value={form.token_id} onChange={(e) => setForm(f => ({ ...f, token_id: e.target.value }))} placeholder="user@pam!token-name"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">API Token Secret</label>
              <input type="password" value={form.token_secret} onChange={(e) => setForm(f => ({ ...f, token_secret: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            {err && <p className="text-[10px] text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Adding…' : 'Add Host'}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setErr(''); }}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {/* Hosts list */}
      {hostList.length > 0 && (
        <div className="space-y-1.5">
          {hostList.map(h => (
            <Card key={h.id} className="p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={h.last_error ? 'warning' : h.last_seen ? 'online' : 'offline'} />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{h.name}</span>
                    <p className="text-[9px] text-gray-400 font-mono truncate">{h.api_url} · node: {h.node_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {h.last_seen && <span className="text-[9px] text-gray-400">{new Date(h.last_seen).toLocaleTimeString()}</span>}
                  <button onClick={() => handleDelete(h.id)} className="p-0.5 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {h.last_error && (
                <div className="mt-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded text-[10px] text-amber-700">
                  ⚠️ {h.last_error}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* LXC Resources */}
      {resLoading && !resList.length ? <Spinner /> : resList.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Database} title="No Proxmox resources" description="Add a Proxmox host to discover LXC containers and VMs." /></Card>
      ) : (
        <ProxmoxLxcList lxcResources={lxcResources} />
      )}
    </div>
  );
};

// ─── VMs Tab ────────────────────────────────────────────────────

const VMsTab = () => {
  const { data: resources, loading } = useApi('/api/proxmox/resources', 10000);
  const resList = resources ?? [];
  const qemuResources = resList.filter(r => r.type === 'qemu');
  const runningCount = qemuResources.filter(r => r.status === 'running').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Virtual Machines</h2>
        {qemuResources.length > 0 && (
          <span className="text-xs text-gray-500">{runningCount} of {qemuResources.length} running</span>
        )}
      </div>

      {loading && !qemuResources.length ? <Spinner /> : qemuResources.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Database} title="No Virtual Machines" description="QEMU VMs will appear here once discovered from your Proxmox hosts." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
          {qemuResources.map(r => <ResourceCard key={`${r.proxmox_host_id}-${r.vmid}`} r={r} />)}
        </div>
      )}
    </div>
  );
};

// ─── Navigation Config ──────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: Gauge },
  { id: 'metrics', label: 'Metrics', Icon: BarChart3 },
  { id: 'logs', label: 'Logs', Icon: ScrollText },
  { id: 'alerts', label: 'Alerts', Icon: ShieldAlert },
  { id: 'vms', label: 'VMs', Icon: Database },
  { id: 'containers', label: 'Containers', Icon: Box },
  { id: 'proxmox', label: 'Proxmox', Icon: Server },
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

const MOBILE_NAV = ['dashboard', 'vms', 'alerts', 'proxmox', 'settings'];

const TAB_COMPONENTS = {
  dashboard: DashboardTab,
  metrics: MetricsTab,
  logs: LogsTab,
  alerts: AlertsTab,
  vms: VMsTab,
  containers: ContainersTab,
  proxmox: ProxmoxTab,
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors">
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
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 h-12 flex items-center px-3 lg:px-6 gap-3 shrink-0">
          <button className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{NAV_ITEMS.find(n => n.id === activeTab)?.label ?? activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>

        {/* Page content — tighter padding */}
        <div className="flex-1 p-2.5 lg:p-4 pb-safe overflow-y-auto">
          <ActiveComponent />
        </div>
      </main>

      {/* Mobile bottom nav — compact */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 bottom-nav-safe">
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
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
