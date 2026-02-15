import React, { useState } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const METRICS = {
  health: { label: 'Overall Health', icon: Activity, unit: '' },
  cpu: { label: 'CPU', icon: Cpu, unit: '%' },
  memory: { label: 'Memory', icon: MemoryStick, unit: '%' },
  disk: { label: 'Disk', icon: HardDrive, unit: '%' },
};

const getStatusColor = (value, metric) => {
  if (value == null) return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
  
  // Health: 0-100 where 100 is HEALTHY.
  if (metric === 'health') {
     if (value >= 80) return 'bg-emerald-500 text-white';
     if (value >= 60) return 'bg-blue-500 text-white';
     if (value >= 40) return 'bg-amber-500 text-white';
     return 'bg-red-500 text-white';
  }

  // Standard usage metrics (CPU, Memory, Disk): High = Bad
  if (value >= 90) return 'bg-red-500 text-white';
  if (value >= 75) return 'bg-amber-500 text-white';
  if (value >= 50) return 'bg-blue-500 text-white';
  return 'bg-emerald-500 text-white';
};

const calculateCompositeScore = (m) => {
  if (m.status !== 'online') return null;
  
  const cpu = m.cpu_usage || 0;
  const mem = m.memory_total ? (m.memory_used / m.memory_total) * 100 : 0;
  const disk = m.disk_total ? (m.disk_used / m.disk_total) * 100 : 0;
  
  // Usage Score (Higher is busier/worse)
  // Weights: CPU 50%, Mem 30%, Disk 20%
  const usageScore = (cpu * 0.5) + (mem * 0.3) + (disk * 0.2);
  
  // Invert for Health Score (100 = Healthy, 0 = Unhealthy)
  return Math.max(0, 100 - usageScore);
};

const ClusterHeatmap = ({ items = [] }) => {
  const [activeMetric, setActiveMetric] = useState('health');

  const getValue = (m, type) => {
    if (m.status !== 'online' && m.status !== 'running') return null; // Handle 'running' for containers/VMs
    switch (type) {
      case 'cpu': return m.cpu_usage;
      case 'memory': return m.memory_total ? (m.memory_used / m.memory_total) * 100 : 0;
      case 'disk': return m.disk_total ? (m.disk_used / m.disk_total) * 100 : 0;
      case 'health': return calculateCompositeScore(m);
      default: return 0;
    }
  };

  const formatValue = (val) => val != null ? Math.round(val) : '–';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-700/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Cluster Health Heatmap
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time utilization across {items.length} nodes (Hosts, VMs, Containers)
          </p>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {Object.entries(METRICS).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = activeMetric === key;
            return (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!items || items.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
          <Server className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No nodes online</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {items.map((m) => {
            const val = getValue(m, activeMetric);
            const colorClass = getStatusColor(val, activeMetric);
            const isOffline = m.status !== 'online' && m.status !== 'running';
            
            return (
              <div key={m.id} className="relative group">
                <div 
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center p-1 transition-all hover:scale-105 hover:shadow-md cursor-default border border-transparent ${
                    isOffline 
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400' 
                      : colorClass
                  }`}
                >
                  <div className="font-bold text-[10px] sm:text-xs truncate w-full text-center px-0.5">
                    {m.name || m.hostname}
                  </div>
                  {!isOffline && (
                    <div className="text-[10px] font-mono opacity-80 mt-0.5">
                      {formatValue(val)}%
                    </div>
                  )}
                  {isOffline && <XCircle className="w-4 h-4 mt-1 opacity-50" />}
                </div>

                {/* Enhanced Tooltip */}
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg py-2 px-3 w-48 z-20 pointer-events-none shadow-xl border border-white/10">
                  <div className="font-semibold mb-1 flex items-center justify-between border-b border-white/10 pb-1">
                    <span className="truncate pr-2">{m.name}</span>
                    <span className={`text-[10px] px-1.5 rounded-full ${isOffline ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="text-gray-400 text-[10px] mb-2 truncate font-mono">{m.hostname || m.type}</div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-1.5"><Cpu className="w-3 h-3" /> CPU</span>
                      <span className={`font-mono ${m.cpu_usage > 80 ? 'text-red-300' : 'text-gray-200'}`}>{formatValue(m.cpu_usage)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-1.5"><MemoryStick className="w-3 h-3" /> Mem</span>
                      <span className={`font-mono ${getValue(m, 'memory') > 80 ? 'text-red-300' : 'text-gray-200'}`}>{formatValue(getValue(m, 'memory'))}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> Disk</span>
                      <span className={`font-mono ${getValue(m, 'disk') > 80 ? 'text-red-300' : 'text-gray-200'}`}>{formatValue(getValue(m, 'disk'))}%</span>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-4 text-[10px] text-gray-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
          <span>Healthy (&lt;50%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
          <span>Moderate (50-75%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
          <span>High (75-90%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span>
          <span>Critical (&gt;90%)</span>
        </div>
      </div>
    </div>
  );
};

export default ClusterHeatmap;
