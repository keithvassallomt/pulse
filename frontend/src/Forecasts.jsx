import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ForecastItem = ({ title, data, warningThreshold }) => {
  if (!data) return null;

  const { currentPct, slope, daysUntilFull, warning } = data;
  const isGrowing = slope > 0;
  
  // Determine status color
  let statusColor = 'text-gray-500';
  let bgColor = 'bg-gray-100 dark:bg-gray-800';
  let icon = <Info className="w-4 h-4" />;
  
  if (warning) {
    statusColor = 'text-red-600';
    bgColor = 'bg-red-50 dark:bg-red-900/20';
    icon = <AlertTriangle className="w-4 h-4" />;
  } else if (isGrowing && daysUntilFull < 90) {
    statusColor = 'text-amber-600';
    bgColor = 'bg-amber-50 dark:bg-amber-900/20';
    icon = <TrendingUp className="w-4 h-4" />;
  } else if (!isGrowing) {
    statusColor = 'text-emerald-600';
    bgColor = 'bg-emerald-50 dark:bg-emerald-900/20';
    icon = <CheckCircle className="w-4 h-4" />;
  }

  return (
    <div className={`p-3 rounded-lg border ${warning ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-gray-700'} ${bgColor} mb-2 last:mb-0`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`${statusColor}`}>{icon}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
        </div>
        <span className="text-xs font-mono text-gray-500">{currentPct}% used</span>
      </div>
      
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-gray-500">
            {isGrowing ? (
                <>Growing at <span className="font-medium text-gray-700 dark:text-gray-300">+{slope}%</span> / day</>
            ) : (
                <>Usage is stable or decreasing</>
            )}
        </div>
        
        {isGrowing && (
            <div className={`text-sm font-bold ${statusColor}`}>
                {daysUntilFull < 1 ? '< 1 day' : `${Math.round(daysUntilFull)} days`} left
            </div>
        )}
      </div>
      
      {/* Progress Bar with projected growth */}
      <div className="mt-2 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
        <div 
            className="h-full bg-blue-500 transition-all duration-500" 
            style={{ width: `${Math.min(currentPct, 100)}%` }} 
        />
        {/* Ghost bar for projection? Maybe too complex for now */}
      </div>
    </div>
  );
};

const Forecasts = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Filter out machines with no forecast data
  const validForecasts = data.filter(f => f.memory || f.disk || f.cpu);

  if (validForecasts.length === 0) {
      return (
        <div className="p-4 text-center text-sm text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            No forecast data available yet. Need at least 24 hours of metrics.
        </div>
      );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        Resource Forecasts
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {validForecasts.map(machine => (
          <div key={machine.machineId} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800 truncate">
              {machine.machineName}
            </h4>
            
            <div className="space-y-2">
              <ForecastItem 
                title="Memory" 
                data={machine.memory} 
                warningThreshold={machine.warningThresholdDays} 
              />
              <ForecastItem 
                title="Disk" 
                data={machine.disk} 
                warningThreshold={machine.warningThresholdDays} 
              />
              <ForecastItem 
                title="CPU Trend" 
                data={machine.cpu} 
                warningThreshold={machine.warningThresholdDays} 
              />
            </div>
            
            <div className="mt-3 text-[10px] text-gray-400 text-right">
                Updated {new Date(machine.generatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Forecasts;
