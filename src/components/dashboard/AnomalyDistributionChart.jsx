import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function AnomalyDistributionChart({ transactions }) {
  const buckets = [
    { range: '0-0.1', min: 0, max: 0.1 },
    { range: '0.1-0.2', min: 0.1, max: 0.2 },
    { range: '0.2-0.3', min: 0.2, max: 0.3 },
    { range: '0.3-0.4', min: 0.3, max: 0.4 },
    { range: '0.4-0.5', min: 0.4, max: 0.5 },
    { range: '0.5-0.6', min: 0.5, max: 0.6 },
    { range: '0.6-0.7', min: 0.6, max: 0.7 },
    { range: '0.7-0.8', min: 0.7, max: 0.8 },
    { range: '0.8-0.9', min: 0.8, max: 0.9 },
    { range: '0.9-1.0', min: 0.9, max: 1.01 },
  ];

  const data = buckets.map(b => ({
    range: b.range,
    count: transactions.filter(t => (t.anomaly_score || 0) >= b.min && (t.anomaly_score || 0) < b.max).length,
    min: b.min,
  }));

  const getBarColor = (min) => {
    if (min >= 0.8) return 'hsl(0, 84%, 60%)';
    if (min >= 0.5) return 'hsl(38, 92%, 50%)';
    if (min >= 0.3) return 'hsl(199, 89%, 48%)';
    return 'hsl(160, 84%, 39%)';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Anomaly Score Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.min)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}