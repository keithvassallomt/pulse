import React, { useMemo, useState } from 'react';
import { Lightbulb, ArrowRight, Server, Cpu, MemoryStick, ChevronDown, SlidersHorizontal } from 'lucide-react';

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
  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(list.map(rec => rec.category).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [list]);

  const severities = useMemo(() => {
    const unique = Array.from(new Set(list.map(rec => rec.severity).filter(Boolean)));
    const order = ['critical', 'warning', 'info'];
    return unique.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter(rec => {
      const categoryMatch = selectedCategory === 'all' || rec.category === selectedCategory;
      const severityMatch = selectedSeverity === 'all' || rec.severity === selectedSeverity;
      return categoryMatch && severityMatch;
    });
  }, [list, selectedCategory, selectedSeverity]);

  const appliedFilters = [selectedCategory !== 'all', selectedSeverity !== 'all'].filter(Boolean).length;

  if (list.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      <button
        type="button"
        onClick={() => setIsCollapsed(prev => !prev)}
        className="w-full flex items-center gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 text-amber-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          <Lightbulb className="w-4 h-4 text-amber-500" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Optimization Insights ({filtered.length}{filtered.length !== list.length ? ` of ${list.length}` : ''})
        </h3>
        {appliedFilters > 0 && (
          <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            {appliedFilters} filter{appliedFilters > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {isCollapsed ? 'Show' : 'Hide'}
        </span>
      </button>

      {!isCollapsed && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Category</span>
              <div className="flex flex-wrap gap-1.5">
                {['all', ...categories].map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {category === 'all' ? 'All' : category.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Severity</span>
              <div className="flex flex-wrap gap-1.5">
                {['all', ...severities].map(severity => (
                  <button
                    key={severity}
                    type="button"
                    onClick={() => setSelectedSeverity(severity)}
                    className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                      selectedSeverity === severity
                        ? severity === 'critical'
                          ? 'bg-red-600 text-white border-red-600'
                          : severity === 'warning'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : severity === 'info'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-amber-400'
                    }`}
                  >
                    {severity === 'all' ? 'All' : severity}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              No recommendations match the selected filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
