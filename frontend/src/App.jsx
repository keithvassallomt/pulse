import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import './index.css';

const API_BASE = window.location.origin;

// ─── Utility Hooks ──────────────────────────────────────────────

function useApi(url, pollInterval = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

const StatusBadge = ({ status }) => {
  const cfg = {
    online: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
    active: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
    running: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: PlayCircle },
    healthy: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
    warning: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle },
    unhealthy: { cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle },
    offline: { cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
    exited: { cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: StopCircle },
    error: { cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
  }[status?.toLowerCase()] || { cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Circle };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {status || 'Unknown'}
    </span>
  );
};

const COLOR_MAP = { blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500' };

const ProgressBar = ({ value, max = 100, color = 'blue', size = 'md' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : (COLOR_MAP[color] || 'bg-blue-500');
  return (
    <div className="w-full">
      <div className={`w-full ${h} bg-gray-100 rounded-full overflow-hidden`}>
        <div className={`${h} rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`} {...props}>{children}</div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="text-center py-16">
    <Icon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
    <p className="text-lg font-medium text-gray-500">{title}</p>
    {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

const SwipeRefreshHint = ({ onRefresh }) => (
  <button onClick={onRefresh} className="pull-hint w-full">
    <ChevronDown className="w-4 h-4" /><span>Pull down or tap to refresh</span>
  </button>
);

// ─── Add Machine Modal ──────────────────────────────────────────

const AddMachineModal = ({ open, onClose, onAdded }) => {
  const [hostname, setHostname] = useState('');
  const [user, setUser] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

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
      onAdded(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Add Machine</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hostname / IP *</label>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="192.168.1.10" required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SSH User *</label>
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="pi" required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Adding…' : 'Add Machine'}
          </button>
        </form>
      </Card>
    </div>
  );
};

// ─── Cluster Overview ───────────────────────────────────────────

const formatBytes = (mb) => {
  if (mb == null) return '–';
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
};

const ClusterOverview = ({ machines }) => {
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

  if (!machines || machines.length === 0) return null;

  return (
    <Card className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50/50 border-blue-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-base font-bold text-gray-900">Cluster Overview</h2>
        <span className="ml-auto text-xs text-gray-400">{online.length}/{total} online</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Avg CPU</span>
            <span className="text-sm font-bold text-gray-900">{avgCpu != null ? `${avgCpu}%` : '–'}</span>
          </div>
          <ProgressBar value={avgCpu || 0} color="blue" />
          <p className="text-[11px] text-gray-400">{cpuCount} machine{cpuCount !== 1 ? 's' : ''} reporting</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><MemoryStick className="w-3.5 h-3.5" /> Total RAM</span>
            <span className="text-sm font-bold text-gray-900">{memPct != null ? `${memPct}%` : '–'}</span>
          </div>
          <ProgressBar value={memPct || 0} color="violet" />
          <p className="text-[11px] text-gray-400">{formatBytes(totalMemUsed)} / {formatBytes(totalMemTotal)}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Total Disk</span>
            <span className="text-sm font-bold text-gray-900">{diskPct != null ? `${diskPct}%` : '–'}</span>
          </div>
          <ProgressBar value={diskPct || 0} color="emerald" />
          <p className="text-[11px] text-gray-400">{formatBytes(totalDiskUsed)} / {formatBytes(totalDiskTotal)}</p>
        </div>
      </div>
    </Card>
  );
};

// ─── Dashboard Tab ──────────────────────────────────────────────

const DashboardTab = () => {
  const { data: machines, loading, error, refetch } = useApi('/api/machines', 5000);
  const { data: anomalies } = useApi('/api/anomalies?limit=5', 15000);
  const { data: forecastData } = useApi('/api/forecasts', 30000);
  const [showAdd, setShowAdd] = useState(false);

  const onlineCt = machines?.filter((m) => m.status === 'online').length ?? 0;
  const totalCt = machines?.length ?? 0;
  const anomalyList = Array.isArray(anomalies) ? anomalies : [];
  const forecasts = forecastData?.data ?? (Array.isArray(forecastData) ? forecastData : []);
  const warnings = forecasts.filter(f => f.hasWarning);

  const handleDelete = async (id) => {
    if (!confirm('Delete this machine and all its data?')) return;
    await fetch(`${API_BASE}/api/machines/${id}`, { method: 'DELETE' });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="sm:hidden"><SwipeRefreshHint onRefresh={refetch} /></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Machines', value: totalCt, Icon: Server, color: 'blue', textColor: 'text-gray-900' },
          { label: 'Online', value: onlineCt, Icon: Wifi, color: 'emerald', textColor: 'text-emerald-600' },
          { label: 'Anomalies', value: anomalyList.length, Icon: Zap, color: 'amber', textColor: anomalyList.length > 0 ? 'text-amber-500' : 'text-gray-400' },
          { label: 'Warnings', value: warnings.length, Icon: TrendingUp, color: 'red', textColor: warnings.length > 0 ? 'text-red-500' : 'text-gray-400' },
        ].map(({ label, value, Icon, color, textColor }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{label}</p>
                <p className={`text-2xl sm:text-3xl font-bold mt-1 ${textColor}`}>{value}</p>
              </div>
              <div className={`p-2.5 sm:p-3 bg-${color}-50 rounded-xl`}><Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${color}-600`} /></div>
            </div>
          </Card>
        ))}
      </div>

      <ClusterOverview machines={machines} />

      {/* Anomaly Banner */}
      {anomalyList.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Recent Anomalies Detected</p>
              <div className="mt-2 space-y-1">
                {anomalyList.slice(0, 3).map((a, i) => (
                  <p key={i} className="text-xs text-amber-700 truncate">
                    <span className="font-medium">{a.metric || a.type}</span> on machine #{a.machine_id} — {a.message || `value: ${a.value}`}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Forecast Warnings Banner */}
      {warnings.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50/50">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">Capacity Warnings</p>
              <div className="mt-2 space-y-1">
                {warnings.slice(0, 3).map((w, i) => (
                  <p key={i} className="text-xs text-red-700 truncate">
                    <span className="font-medium">{w.metric}</span> on machine #{w.machineId} — {w.warning || 'threshold approaching'}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Machine
        </button>
        <button onClick={refetch}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Machine List */}
      {error ? (
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm">Error: {error}. Is the backend running?</p>
            <button onClick={refetch} className="ml-auto text-sm underline">Retry</button>
          </div>
        </Card>
      ) : loading && !machines ? <Spinner /> : !machines || machines.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Server} title="No machines yet" description="Add a machine to start monitoring." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {machines.map((m) => <MachineCard key={m.id} machine={m} onDelete={handleDelete} />)}
        </div>
      )}

      <AddMachineModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={refetch} />
    </div>
  );
};

const MachineCard = ({ machine: m, onDelete }) => {
  const memPct = m.memory_total > 0 ? Math.round((m.memory_used / m.memory_total) * 100) : null;
  const diskPct = m.disk_total > 0 ? Math.round((m.disk_used / m.disk_total) * 100) : null;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shrink-0">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{m.name || m.hostname}</h3>
            <p className="text-xs text-gray-400 truncate">{m.hostname} · {m.user}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={m.status} />
          <button onClick={() => onDelete(m.id)}
            className="p-1.5 text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
            title="Delete machine"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="space-y-3">
        {[
          { label: 'CPU', Icon: Cpu, value: m.cpu_usage != null ? `${Math.round(m.cpu_usage)}%` : '–', pct: m.cpu_usage || 0, color: 'blue' },
          { label: 'Memory', Icon: MemoryStick, value: memPct != null ? `${memPct}%` : '–', pct: memPct || 0, color: 'violet' },
          { label: 'Disk', Icon: HardDrive, value: diskPct != null ? `${diskPct}%` : '–', pct: diskPct || 0, color: 'emerald' },
        ].map(({ label, Icon, value, pct, color }) => (
          <div key={label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</span>
              <span className="font-medium text-gray-700">{value}</span>
            </div>
            <ProgressBar value={pct} color={color} size="sm" />
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center">
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {m.last_seen ? new Date(m.last_seen).toLocaleString() : 'Never seen'}
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
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Uptime — Last 30 Days</h3>
        <span className={`text-sm font-bold ${overallPct >= 95 ? 'text-emerald-600' : overallPct >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
          {overallPct}% overall
        </span>
      </div>
      <div className="flex gap-[2px] sm:gap-1">
        {uptimeData.map((d) => (
          <div key={d.date} className="flex-1 group relative">
            <div className={`w-full rounded-sm sm:rounded transition-all ${getColor(d.uptimePct)}`} style={{ height: '32px' }} />
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {d.date}: {d.uptimePct}% ({d.uptimeMinutes}m)
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-gray-400">{uptimeData[0]?.date}</span>
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> 0%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> &lt;50%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> 50-94%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> 95%+</span>
        </div>
        <span className="text-[11px] text-gray-400">{uptimeData[uptimeData.length - 1]?.date}</span>
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <h2 className="text-lg font-bold text-gray-900">Historical Metrics</h2>
        {machines?.length > 0 && (
          <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
          </select>
        )}
      </div>

      {effectiveId && <UptimeChart machineId={effectiveId} />}

      {loading && !metricsData.length ? <Spinner /> : !metricsData.length ? (
        <Card className="p-8"><EmptyState icon={BarChart3} title="No metrics yet" description="Metrics will appear after the first collection cycle." /></Card>
      ) : (
        <>
          {/* CPU Chart */}
          <Card className="p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">CPU Usage (last {metricsData.length} samples)</h3>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-end gap-[2px] sm:gap-1 h-28 sm:h-32 min-w-0">
                {[...metricsData].reverse().map((m, i) => {
                  const pct = Math.max(1, Math.round(m.cpu_usage || 0));
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-blue-500';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative chart-bar-group">
                      <div className={`w-full ${barColor} rounded-t transition-all min-w-[3px] sm:min-w-[4px]`} style={{ height: `${pct}%` }} />
                      <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {Math.round(m.cpu_usage || 0)}% · {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Memory Chart */}
          <Card className="p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Memory Usage</h3>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-end gap-[2px] sm:gap-1 h-28 sm:h-32 min-w-0">
                {[...metricsData].reverse().map((m, i) => {
                  const pct = m.memory_total > 0 ? Math.max(1, Math.round((m.memory_used / m.memory_total) * 100)) : 0;
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-violet-500';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative chart-bar-group">
                      <div className={`w-full ${barColor} rounded-t transition-all min-w-[3px] sm:min-w-[4px]`} style={{ height: `${pct}%` }} />
                      <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {pct}% · {m.memory_used}/{m.memory_total} MB
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm metrics-table">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-3 sm:px-5 py-3">Timestamp</th>
                    <th className="px-3 sm:px-5 py-3">CPU %</th>
                    <th className="px-3 sm:px-5 py-3">Memory</th>
                    <th className="px-3 sm:px-5 py-3 hidden sm:table-cell">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {metricsData.slice(0, 20).map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-3 sm:px-5 py-3 text-gray-600 whitespace-nowrap text-xs sm:text-sm">{new Date(m.timestamp).toLocaleString()}</td>
                      <td className="px-3 sm:px-5 py-3 font-mono">{m.cpu_usage != null ? `${Math.round(m.cpu_usage)}%` : '–'}</td>
                      <td className="px-3 sm:px-5 py-3 font-mono text-xs sm:text-sm">{m.memory_total > 0 ? `${m.memory_used}/${m.memory_total} MB` : '–'}</td>
                      <td className="px-3 sm:px-5 py-3 font-mono hidden sm:table-cell">{m.disk_total > 0 ? `${m.disk_used}/${m.disk_total} MB` : '–'}</td>
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
    error: 'bg-red-100 text-red-700 border-red-200',
    warn: 'bg-amber-100 text-amber-700 border-amber-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    debug: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const pagination = results?.pagination;
  const logs = results?.data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Log Search</h2>
      <Card className="p-4 sm:p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search log messages…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={machineId} onChange={(e) => setMachineId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">All Machines</option>
              {(machines ?? []).map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">All Levels</option>
              {(levels ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
            <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              <Terminal className="w-4 h-4" /> Search
            </button>
            <button type="button" onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            {pagination && <span className="text-xs text-gray-400 ml-auto">{pagination.total} result{pagination.total !== 1 ? 's' : ''}</span>}
          </div>
        </form>
      </Card>

      {error ? (
        <Card className="p-6"><div className="flex items-center gap-3 text-red-700"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">Error: {error}</p><button onClick={() => fetchLogs(page)} className="ml-auto text-sm underline">Retry</button></div></Card>
      ) : loading && !logs.length ? <Spinner /> : logs.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Terminal} title="No logs found" description="Try adjusting your search filters." /></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 sm:px-5 py-3 w-40">Timestamp</th><th className="px-3 sm:px-5 py-3 w-20">Level</th>
                  <th className="px-3 sm:px-5 py-3 w-32">Machine</th><th className="px-3 sm:px-5 py-3">Message</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-3 sm:px-5 py-3 text-gray-600 whitespace-nowrap text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '–'}</td>
                      <td className="px-3 sm:px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${levelColors[log.level?.toLowerCase()] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{log.level || '–'}</span>
                      </td>
                      <td className="px-3 sm:px-5 py-3 text-xs text-gray-600 truncate max-w-[8rem]">{log.machine_name || log.machine_hostname || `#${log.machine_id}`}</td>
                      <td className="px-3 sm:px-5 py-3 text-xs text-gray-700 font-mono break-all">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
              <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
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
  const containerData = containers ?? [];

  const updatePolicy = async (containerId, maxRetries, gracePeriod) => {
    await fetch(`${API_BASE}/api/containers/policy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ containerId, maxRetries, gracePeriod }),
    });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <h2 className="text-lg font-bold text-gray-900">Container Management</h2>
        {machines?.length > 0 && (
          <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name || m.hostname}</option>)}
          </select>
        )}
      </div>

      {loading && !containerData.length ? <Spinner /> : !containerData.length ? (
        <Card className="p-8"><EmptyState icon={Box} title="No containers found" description="Docker containers will appear here after collection." /></Card>
      ) : (
        <div className="space-y-3">
          {containerData.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${c.state === 'running' ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                      <Box className={`w-5 h-5 ${c.state === 'running' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{c.name}</h4>
                      <p className="text-xs text-gray-400 truncate font-mono">{c.image}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={c.state} />
                    {c.health_status && c.health_status !== 'unknown' && c.health_status !== 'not_running' && <StatusBadge status={c.health_status} />}
                    <button onClick={() => setExpandedPolicy(expandedPolicy === c.id ? null : c.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" title="Auto-heal policy">
                      <Shield className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{c.status}</p>
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
    <div className="px-5 pb-5 pt-0">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto-Heal Policy</h5>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">Max Retries</label>
            <input type="number" min="0" max="99" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Grace Period (s)</label>
            <input type="number" min="0" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Retries: {c.current_retries ?? 0} · Last restart: {c.last_restart ? new Date(c.last_restart).toLocaleString() : 'Never'}</span>
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Policy'}
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
  const anomalyList = Array.isArray(anomalies) ? anomalies : [];
  const forecasts = forecastResp?.data ?? (Array.isArray(forecastResp) ? forecastResp : []);

  const triggerDetection = async () => {
    setDetecting(true);
    try { await fetch(`${API_BASE}/api/anomalies/detect`, { method: 'POST' }); refetchAnom(); }
    catch (e) { console.error(e); }
    finally { setDetecting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Anomalies &amp; Forecasts</h2>
        <button onClick={triggerDetection} disabled={detecting}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
          <Zap className={`w-4 h-4 ${detecting ? 'animate-pulse' : ''}`} /> {detecting ? 'Detecting…' : 'Run Detection'}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Recent Anomalies</h3>
        {anomLoading && !anomalyList.length ? <Spinner /> : anomalyList.length === 0 ? (
          <Card className="p-6"><EmptyState icon={CheckCircle} title="No anomalies detected" description="All systems operating normally." /></Card>
        ) : (
          <div className="space-y-2">
            {anomalyList.map((a, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg shrink-0"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{a.metric || a.type || 'Anomaly'}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Machine #{a.machine_id}</span>
                      {a.severity && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.severity === 'high' || a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.severity}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{a.message || `Value: ${a.value}`}</p>
                    {a.detected_at && <p className="text-[11px] text-gray-400 mt-1">{new Date(a.detected_at).toLocaleString()}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-500" /> Capacity Forecasts</h3>
        {fcLoading && !forecasts.length ? <Spinner /> : forecasts.length === 0 ? (
          <Card className="p-6"><EmptyState icon={TrendingUp} title="No forecast data" description="Forecasts require sufficient metric history." /></Card>
        ) : (
          <div className="space-y-2">
            {forecasts.map((f, i) => (
              <Card key={i} className={`p-4 ${f.hasWarning ? 'border-red-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${f.hasWarning ? 'bg-red-50' : 'bg-blue-50'}`}>
                    <TrendingUp className={`w-4 h-4 ${f.hasWarning ? 'text-red-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{f.metric || 'Resource'}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Machine #{f.machineId}</span>
                      {f.hasWarning && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Warning</span>}
                    </div>
                    {f.warning && <p className="text-xs text-red-600 mt-1">{f.warning}</p>}
                    {f.forecast && <p className="text-xs text-gray-500 mt-1">Forecast: {typeof f.forecast === 'number' ? `${Math.round(f.forecast)}%` : JSON.stringify(f.forecast)}</p>}
                    {f.daysUntilFull != null && f.daysUntilFull !== Infinity && <p className="text-xs text-gray-500 mt-0.5">Days until full: ~{Math.round(f.daysUntilFull)}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Terminal Tab ───────────────────────────────────────────────

const TerminalTab = () => {
  const { data: machines } = useApi('/api/machines');
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">SSH Terminal</h2>
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="p-4 bg-gray-900 rounded-2xl inline-block"><Terminal className="w-10 h-10 text-emerald-400" /></div>
          <div>
            <p className="text-lg font-semibold text-gray-900">SSH Terminal Access</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Connect to your machines via SSH directly from the browser. A WebSocket-based terminal will be available here once the backend SSH proxy endpoint is implemented.
            </p>
          </div>
          {machines?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {machines.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl text-sm text-gray-600">
                  <Server className="w-4 h-4" />{m.user}@{m.hostname}
                </span>
              ))}
            </div>
          )}
          <div className="bg-gray-900 rounded-xl p-4 text-left font-mono text-sm text-green-400 max-w-lg mx-auto mt-4">
            <p className="text-gray-500">$ ssh {machines?.[0]?.user || 'user'}@{machines?.[0]?.hostname || 'host'}</p>
            <p className="text-gray-500">Connected to {machines?.[0]?.hostname || 'host'}.</p>
            <p className="animate-pulse">▊</p>
          </div>
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
      setForm({ name: '', type: 'discord', url: '', events: [] }); setShowAdd(false); refetch();
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => { if (!confirm('Delete this webhook?')) return; await fetch(`${API_BASE}/api/webhooks/${id}`, { method: 'DELETE' }); refetch(); };
  const handleToggle = async (wh) => { await fetch(`${API_BASE}/api/webhooks/${wh.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !wh.enabled }) }); refetch(); };
  const handleTest = async (id) => {
    setTesting(id); setTestResult({});
    try { const res = await fetch(`${API_BASE}/api/webhooks/${id}/test`, { method: 'POST' }); const j = await res.json(); setTestResult({ [id]: res.ok ? '✅ Sent!' : `❌ ${j.error}` }); }
    catch (e) { setTestResult({ [id]: `❌ ${e.message}` }); }
    finally { setTesting(null); }
  };
  const toggleEvent = (evt) => setForm(f => ({ ...f, events: f.events.includes(evt) ? f.events.filter(e => e !== evt) : [...f.events, evt] }));

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-violet-50 rounded-xl shrink-0"><Send className="w-6 h-6 text-violet-600" /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">Alert Webhooks</h3>
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Webhook
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">Send alerts to Discord or Telegram when machines go offline, load is high, or containers are unhealthy.</p>

          {showAdd && (
            <form onSubmit={handleAdd} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Name *</label>
                  <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Discord Alert"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                    <option value="discord">Discord</option><option value="telegram">Telegram</option><option value="generic">Generic (JSON POST)</option>
                  </select></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Webhook URL *</label>
                <input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder={form.type === 'discord' ? 'https://discord.com/api/webhooks/...' : form.type === 'telegram' ? 'https://api.telegram.org/bot.../sendMessage?chat_id=...' : 'https://...'}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono text-xs" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Alert Types (leave empty for all)</label>
                <div className="flex flex-wrap gap-2">
                  {ALERT_TYPES.map(at => (
                    <button key={at.value} type="button" onClick={() => toggleEvent(at.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.events.includes(at.value) ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-200'}`}>
                      {at.label}
                    </button>
                  ))}
                </div></div>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50">{submitting ? 'Adding…' : 'Add Webhook'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setErr(''); }} className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}

          {loading ? <div className="text-sm text-gray-400">Loading…</div> : webhookList.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">No webhooks configured yet.</div>
          ) : (
            <div className="space-y-2">
              {webhookList.map(wh => (
                <div key={wh.id} className={`flex items-center gap-3 p-3 rounded-xl border ${wh.enabled ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className={`p-2 rounded-lg shrink-0 ${wh.type === 'discord' ? 'bg-indigo-50' : wh.type === 'telegram' ? 'bg-blue-50' : 'bg-gray-100'}`}>
                    <Send className={`w-4 h-4 ${wh.type === 'discord' ? 'text-indigo-600' : wh.type === 'telegram' ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{wh.name}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase">{wh.type}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono truncate">{wh.url.substring(0, 50)}…</p>
                    {wh.events?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{wh.events.map(e => <span key={e} className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{e}</span>)}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Test">
                      <Zap className={`w-4 h-4 ${testing === wh.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button onClick={() => handleToggle(wh)} className={`p-1.5 rounded-lg transition-colors ${wh.enabled ? 'hover:bg-amber-50 text-emerald-500 hover:text-amber-600' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600'}`} title={wh.enabled ? 'Disable' : 'Enable'}>
                      {wh.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(wh.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {testResult[wh.id] && <span className="text-xs ml-2">{testResult[wh.id]}</span>}
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
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
      <button onClick={() => setOn(!on)} role="switch" aria-checked={on}
        className={`relative w-10 h-6 rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
};

const SettingsTab = () => {
  const [collectStatus, setCollectStatus] = useState(null);
  const [collecting, setCollecting] = useState(false);

  const triggerCollect = async () => {
    setCollecting(true); setCollectStatus(null);
    try { const res = await fetch(`${API_BASE}/api/collect`, { method: 'POST' }); const json = await res.json(); setCollectStatus({ ok: res.ok, message: json.message || json.error }); }
    catch (e) { setCollectStatus({ ok: false, message: e.message }); }
    finally { setCollecting(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-bold text-gray-900">Settings</h2>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-xl shrink-0"><RefreshCw className="w-6 h-6 text-blue-600" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Data Collection</h3>
            <p className="text-sm text-gray-500 mt-1">The collector runs automatically every 60 seconds. You can also trigger a manual collection cycle.</p>
            <button onClick={triggerCollect} disabled={collecting}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${collecting ? 'animate-spin' : ''}`} /> {collecting ? 'Collecting…' : 'Trigger Collection'}
            </button>
            {collectStatus && <p className={`text-sm mt-2 ${collectStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>{collectStatus.message}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-50 rounded-xl shrink-0"><Bell className="w-6 h-6 text-amber-600" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <p className="text-sm text-gray-500 mt-1">Configure alerts for machine status changes, container health events, and resource thresholds.</p>
            <div className="mt-4 space-y-3">
              <NotifToggle label="Machine goes offline" defaultOn />
              <NotifToggle label="Container becomes unhealthy" defaultOn />
              <NotifToggle label="CPU usage > 90%" defaultOn={false} />
              <NotifToggle label="Disk usage > 85%" defaultOn={false} />
              <NotifToggle label="Auto-heal max retries reached" defaultOn />
              <NotifToggle label="Anomaly detected" defaultOn />
              <NotifToggle label="Capacity forecast warning" defaultOn={false} />
            </div>
          </div>
        </div>
      </Card>

      <WebhookSettings />

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl shrink-0"><Shield className="w-6 h-6 text-emerald-600" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Setup Help</h3>
            <p className="text-sm text-gray-500 mt-1 mb-3">Quick reference for getting Pulse up and running.</p>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-800 mb-1">1. Configure SSH Keys</h4>
                <p className="text-xs text-gray-500">Pulse uses key-based SSH. By default it reads <code className="bg-gray-100 px-1 rounded">~/.ssh/id_rsa</code>. Set <code className="bg-gray-100 px-1 rounded">SSH_KEY_PATH</code> to use a different key.</p>
                <div className="mt-1.5 bg-gray-900 text-green-400 text-xs font-mono rounded-lg p-3 overflow-x-auto">
                  <p># Generate a key (if needed)</p><p>ssh-keygen -t ed25519 -C "pulse-monitor"</p>
                  <p className="mt-1"># Copy public key to target machine</p><p>ssh-copy-id -i ~/.ssh/id_ed25519.pub user@host</p>
                  <p className="mt-1"># Tell Pulse where the private key is</p><p>export SSH_KEY_PATH=~/.ssh/id_ed25519</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-1">2. Add Machines</h4>
                <p className="text-xs text-gray-500">Go to <strong>Dashboard → Add Machine</strong>. Enter the hostname/IP and SSH user.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-1">3. Monitor</h4>
                <p className="text-xs text-gray-500"><strong>Metrics</strong> — CPU, memory, disk charts and 30-day uptime heatmap. <strong>Alerts</strong> — Anomaly detection and capacity forecasting. <strong>Containers</strong> — Docker container status with auto-heal policies.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-1">Troubleshooting</h4>
                <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5">
                  <li>Machine offline? Verify: <code className="bg-gray-100 px-1 rounded">ssh user@host "echo ok"</code></li>
                  <li>No metrics? Wait 60s or trigger collection above</li>
                  <li>SSH key error? Check <code className="bg-gray-100 px-1 rounded">SSH_KEY_PATH</code></li>
                  <li>No containers? Ensure Docker is installed and the SSH user can run <code className="bg-gray-100 px-1 rounded">docker</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gray-100 rounded-xl shrink-0"><Info className="w-6 h-6 text-gray-600" /></div>
          <div>
            <h3 className="font-semibold text-gray-900">About Pulse</h3>
            <p className="text-sm text-gray-500 mt-1">Pulse is a lightweight infrastructure monitoring tool. It connects to your machines via SSH, collects system metrics, monitors Docker containers, detects anomalies, forecasts capacity, and provides auto-healing capabilities.</p>
            <p className="text-xs text-gray-400 mt-2">Version 1.0.0</p>
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

// Bottom bar shows subset on mobile
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

function App() {
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

      {/* Sidebar — dark theme */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-gray-900 transform transition-all duration-200 ease-out flex flex-col
        lg:static lg:z-auto
        ${isDesktop ? (sidebarCollapsed ? 'w-[72px]' : 'w-64') : 'w-64'}
        ${!isDesktop && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-3 h-16 border-b border-gray-800 shrink-0 ${sidebarCollapsed && isDesktop ? 'justify-center px-2' : 'px-5'}`}>
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          {!(sidebarCollapsed && isDesktop) && <span className="text-lg font-bold text-white">Pulse</span>}
          {!isDesktop && (
            <button className="ml-auto p-1" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto sidebar-scroll py-3 ${sidebarCollapsed && isDesktop ? 'px-2' : 'px-3'} space-y-1`}>
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
              className={`sidebar-btn relative w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
                ${sidebarCollapsed && isDesktop ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
                ${activeTab === id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}>
              <Icon className="w-5 h-5 shrink-0" />
              {!(sidebarCollapsed && isDesktop) && label}
              {sidebarCollapsed && isDesktop && (
                <div className="sidebar-tooltip absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                  {label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        {isDesktop && (
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center justify-center h-12 border-t border-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        )}

        {/* Status indicator */}
        <div className={`shrink-0 border-t border-gray-800 p-4 ${sidebarCollapsed && isDesktop ? 'flex justify-center' : ''}`}>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {!(sidebarCollapsed && isDesktop) && <span>System active</span>}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 min-w-0 flex flex-col ${isMobile ? 'pb-16' : ''}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 h-16 flex items-center px-4 lg:px-8 gap-4 shrink-0">
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 capitalize">{activeTab}</h1>
        </header>

        {/* Page content */}
        <div className="flex-1 p-3 sm:p-4 lg:p-8 pb-safe overflow-y-auto">
          <ActiveComponent />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 bottom-nav-safe">
          <div className="flex items-center justify-around h-14">
            {MOBILE_NAV.map(id => {
              const item = NAV_ITEMS.find(n => n.id === id);
              if (!item) return null;
              const { Icon, label } = item;
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0
                    ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-[10px] font-medium truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
