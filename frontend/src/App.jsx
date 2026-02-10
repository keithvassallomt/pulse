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
  MemoryStick,
  Shield,
  Eye,
  EyeOff,
  Send,
  Circle,
  BarChart3,
  MonitorSmartphone,
  Wifi,
  WifiOff,
  PlayCircle,
  StopCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Gauge,
} from 'lucide-react';
import './index.css';

const API_BASE = window.location.origin;

// ─── Utility Hooks ──────────────────────────────────────────────

function useApi(url, pollInterval = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
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
    if (pollInterval) {
      const id = setInterval(fetchData, pollInterval);
      return () => clearInterval(id);
    }
  }, [fetchData, pollInterval]);

  return { data, loading, error, refetch: fetchData };
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

const ProgressBar = ({ value, max = 100, color = 'blue', size = 'md' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const barColor =
    pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : `bg-${color}-500`;

  return (
    <div className="w-full">
      <div className={`w-full ${h} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`${h} rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`} {...props}>
    {children}
  </div>
);

// eslint-disable-next-line no-unused-vars
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
    setSubmitting(true);
    setErr('');
    try {
      const res = await fetch(`${API_BASE}/api/machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname, user, name: name || hostname }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setHostname(''); setUser(''); setName('');
      onAdded();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
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

// ─── Dashboard Tab ──────────────────────────────────────────────

const DashboardTab = () => {
  const { data: machines, loading, error, refetch } = useApi('/api/machines', 5000);
  const [showAdd, setShowAdd] = useState(false);

  const onlineCt = machines?.filter((m) => m.status === 'online').length ?? 0;
  const totalCt = machines?.length ?? 0;

  const handleDelete = async (id) => {
    if (!confirm('Delete this machine and all its data?')) return;
    await fetch(`${API_BASE}/api/machines/${id}`, { method: 'DELETE' });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Machines</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalCt}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl"><Server className="w-6 h-6 text-blue-600" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Online</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{onlineCt}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl"><Wifi className="w-6 h-6 text-emerald-600" /></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Offline</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{totalCt - onlineCt}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl"><WifiOff className="w-6 h-6 text-red-500" /></div>
          </div>
        </Card>
        <Card className="p-5 flex items-center justify-center">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
            <Plus className="w-5 h-5" /> Add Machine
          </button>
        </Card>
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
      ) : loading && !machines ? (
        <Spinner />
      ) : !machines || machines.length === 0 ? (
        <Card className="p-8">
          <EmptyState icon={Server} title="No machines yet" description="Add a machine to start monitoring." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {machines.map((m) => (
            <MachineCard key={m.id} machine={m} onDelete={handleDelete} />
          ))}
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
            className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
            title="Delete machine">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
            <span className="font-medium text-gray-700">{m.cpu_usage != null ? `${Math.round(m.cpu_usage)}%` : '–'}</span>
          </div>
          <ProgressBar value={m.cpu_usage || 0} color="blue" size="sm" />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 flex items-center gap-1"><MemoryStick className="w-3 h-3" /> Memory</span>
            <span className="font-medium text-gray-700">{memPct != null ? `${memPct}%` : '–'}</span>
          </div>
          <ProgressBar value={memPct || 0} color="violet" size="sm" />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 flex items-center gap-1"><HardDrive className="w-3 h-3" /> Disk</span>
            <span className="font-medium text-gray-700">{diskPct != null ? `${diskPct}%` : '–'}</span>
          </div>
          <ProgressBar value={diskPct || 0} color="emerald" size="sm" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {m.last_seen ? new Date(m.last_seen).toLocaleString() : 'Never seen'}
        </span>
      </div>
    </Card>
  );
};

// ─── Metrics Tab ────────────────────────────────────────────────

const MetricsTab = () => {
  const { data: machines } = useApi('/api/machines', 10000);
  const [selectedId, setSelectedId] = useState(null);

  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;

  const { data: metrics, loading } = useApi(
    effectiveId ? `/api/metrics/${effectiveId}?limit=50` : null,
    effectiveId ? 10000 : null
  );

  const metricsData = metrics?.data ?? metrics ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <h2 className="text-lg font-bold text-gray-900">Historical Metrics</h2>
        {machines?.length > 0 && (
          <select value={effectiveId || ''} onChange={(e) => setSelectedId(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.hostname}</option>
            ))}
          </select>
        )}
      </div>

      {loading && !metricsData.length ? (
        <Spinner />
      ) : !metricsData.length ? (
        <Card className="p-8">
          <EmptyState icon={BarChart3} title="No metrics yet" description="Metrics will appear after the first collection cycle." />
        </Card>
      ) : (
        <>
          {/* Simple ASCII-style bar chart */}
          <Card className="p-6 overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">CPU Usage (last {metricsData.length} samples)</h3>
            <div className="flex items-end gap-1 h-32 min-w-[400px]">
              {[...metricsData].reverse().map((m, i) => {
                const pct = Math.max(1, Math.round(m.cpu_usage || 0));
                const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-blue-500';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className={`w-full ${barColor} rounded-t transition-all min-w-[4px]`} style={{ height: `${pct}%` }} />
                    <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {Math.round(m.cpu_usage || 0)}% · {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">CPU %</th>
                    <th className="px-5 py-3">Memory</th>
                    <th className="px-5 py-3">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {metricsData.slice(0, 20).map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{new Date(m.timestamp).toLocaleString()}</td>
                      <td className="px-5 py-3 font-mono">{m.cpu_usage != null ? `${Math.round(m.cpu_usage)}%` : '–'}</td>
                      <td className="px-5 py-3 font-mono">
                        {m.memory_total > 0 ? `${m.memory_used}/${m.memory_total} MB` : '–'}
                      </td>
                      <td className="px-5 py-3 font-mono">
                        {m.disk_total > 0 ? `${m.disk_used}/${m.disk_total} MB` : '–'}
                      </td>
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

// ─── Containers Tab ─────────────────────────────────────────────

const ContainersTab = () => {
  const { data: machines } = useApi('/api/machines', 15000);
  const [selectedId, setSelectedId] = useState(null);

  const effectiveId = selectedId ?? machines?.[0]?.id ?? null;

  const { data: containers, loading, refetch } = useApi(
    effectiveId ? `/api/containers/${effectiveId}` : null,
    effectiveId ? 10000 : null
  );
  const [expandedPolicy, setExpandedPolicy] = useState(null);

  const containerData = containers ?? [];

  const updatePolicy = async (containerId, maxRetries, gracePeriod) => {
    await fetch(`${API_BASE}/api/containers/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.hostname}</option>
            ))}
          </select>
        )}
      </div>

      {loading && !containerData.length ? (
        <Spinner />
      ) : !containerData.length ? (
        <Card className="p-8">
          <EmptyState icon={Box} title="No containers found" description="Docker containers will appear here after collection." />
        </Card>
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
                    {c.health_status && c.health_status !== 'unknown' && c.health_status !== 'not_running' && (
                      <StatusBadge status={c.health_status} />
                    )}
                    <button
                      onClick={() => setExpandedPolicy(expandedPolicy === c.id ? null : c.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                      title="Auto-heal policy"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{c.status}</p>
              </div>

              {expandedPolicy === c.id && (
                <PolicyEditor
                  container={c}
                  onSave={(maxRetries, gracePeriod) => updatePolicy(c.id, maxRetries, gracePeriod)}
                />
              )}
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

  const handleSave = async () => {
    setSaving(true);
    await onSave(maxRetries, gracePeriod);
    setSaving(false);
  };

  return (
    <div className="px-5 pb-5 pt-0">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Auto-Heal Policy</h5>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Max Retries</label>
            <input type="number" min="0" max="99" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Grace Period (s)</label>
            <input type="number" min="0" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Current retries: {c.current_retries ?? 0} · Last restart: {c.last_restart ? new Date(c.last_restart).toLocaleString() : 'Never'}</span>
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Policy'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Terminal Tab (placeholder - no WebSocket SSH yet) ──────────

const TerminalTab = () => {
  const { data: machines } = useApi('/api/machines');

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">SSH Terminal</h2>
      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="p-4 bg-gray-900 rounded-2xl inline-block">
            <Terminal className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">SSH Terminal Access</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Connect to your machines via SSH directly from the browser.
              A WebSocket-based terminal will be available here once the backend SSH proxy endpoint is implemented.
            </p>
          </div>
          {machines?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {machines.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl text-sm text-gray-600">
                  <Server className="w-4 h-4" />
                  {m.user}@{m.hostname}
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

const SettingsTab = () => {
  const [collectStatus, setCollectStatus] = useState(null);
  const [collecting, setCollecting] = useState(false);

  const triggerCollect = async () => {
    setCollecting(true);
    setCollectStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/collect`, { method: 'POST' });
      const json = await res.json();
      setCollectStatus({ ok: res.ok, message: json.message || json.error });
    } catch (e) {
      setCollectStatus({ ok: false, message: e.message });
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-bold text-gray-900">Settings</h2>

      {/* Manual Collection */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-xl shrink-0">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Data Collection</h3>
            <p className="text-sm text-gray-500 mt-1">
              The collector runs automatically every 60 seconds. You can also trigger a manual collection cycle.
            </p>
            <button onClick={triggerCollect} disabled={collecting}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${collecting ? 'animate-spin' : ''}`} />
              {collecting ? 'Collecting…' : 'Trigger Collection'}
            </button>
            {collectStatus && (
              <p className={`text-sm mt-2 ${collectStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {collectStatus.message}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Notifications placeholder */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-50 rounded-xl shrink-0">
            <Bell className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configure alerts for machine status changes, container health events, and resource thresholds.
            </p>
            <div className="mt-4 space-y-3">
              <NotifToggle label="Machine goes offline" defaultOn />
              <NotifToggle label="Container becomes unhealthy" defaultOn />
              <NotifToggle label="CPU usage &gt; 90%" defaultOn={false} />
              <NotifToggle label="Disk usage &gt; 85%" defaultOn={false} />
              <NotifToggle label="Auto-heal max retries reached" defaultOn />
            </div>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gray-100 rounded-xl shrink-0">
            <Info className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">About Pulse</h3>
            <p className="text-sm text-gray-500 mt-1">
              Pulse is a lightweight infrastructure monitoring tool. It connects to your machines via SSH,
              collects system metrics, monitors Docker containers, and provides auto-healing capabilities.
            </p>
            <p className="text-xs text-gray-400 mt-2">Version 1.0.0</p>
          </div>
        </div>
      </Card>
    </div>
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

// ─── Sidebar Navigation ─────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: Gauge },
  { id: 'metrics', label: 'Metrics', Icon: BarChart3 },
  { id: 'containers', label: 'Containers', Icon: Box },
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

const TAB_COMPONENTS = {
  dashboard: DashboardTab,
  metrics: MetricsTab,
  containers: ContainersTab,
  terminal: TerminalTab,
  settings: SettingsTab,
};

// ─── App Shell ──────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-200 ease-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">Pulse</span>
          <button className="ml-auto lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {/* eslint-disable-next-line no-unused-vars */}
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>System active</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 h-16 flex items-center px-4 lg:px-8 gap-4">
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 capitalize">{activeTab}</h1>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}

export default App;
