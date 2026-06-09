import React from 'react';

export default function AnomalyScoreBar({ score }) {
  const safeScore = Math.min(1, Math.max(0, score || 0));
  const percentage = Math.round(safeScore * 100);

  const getColor = () => {
    if (safeScore >= 0.8) return 'bg-red-500';
    if (safeScore >= 0.5) return 'bg-amber-500';
    if (safeScore >= 0.3) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8">{percentage}%</span>
    </div>
  );
}