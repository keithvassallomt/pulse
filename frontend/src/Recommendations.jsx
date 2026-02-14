import React from 'react';
import { Lightbulb, ArrowRight, CheckCircle, AlertTriangle, Info, Server, Cpu, MemoryStick } from 'lucide-react';

const RecommendationCard = ({ rec }) => {
  const severityColor = {
    info: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    critical: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  }[rec.severity] || 'bg-gray-50 text-gray-700 border-gray-100';

  const Icon = rec.category === 'cpu' ? Cpu : rec.category === 'memory' ? MemoryStick : Server;

  return (
    <div className={`p-3 rounded-lg border ${severityColor} flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 shrink-0 opacity-70" />
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">{rec.type} • {rec.name}</span>
        </div>
        <span className="text-[10px] font-mono opacity-70 px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded">
          {rec.category.toUpperCase()}
        </span>
      </div>
      
      <div>
        <p className="text-sm font-medium leading-snug">{rec.message}</p>
        <div className="mt-2 flex items-center gap-2 text-xs opacity-90">
            <span className="font-semibold">Current Limit: {rec.current_limit}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-bold underline decoration-dotted">{rec.suggested_action}</span>
        </div>
      </div>
    </div>
  );
};

export default function Recommendations({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Optimization Insights ({data.length})
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}
      </div>
    </div>
  );
}
