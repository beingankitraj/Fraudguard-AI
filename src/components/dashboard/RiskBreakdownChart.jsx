import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  Normal: 'hsl(160, 84%, 39%)',
  Suspicious: 'hsl(38, 92%, 50%)',
  Fraud: 'hsl(0, 84%, 60%)',
};

export default function RiskBreakdownChart({ transactions }) {
  const data = [
    { name: 'Normal', value: transactions.filter(t => t.fraud_label === 'Normal' || !t.fraud_label).length },
    { name: 'Suspicious', value: transactions.filter(t => t.fraud_label === 'Suspicious').length },
    { name: 'Fraud', value: transactions.filter(t => t.fraud_label === 'Fraud').length },
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Risk Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] flex items-center">
          <ResponsiveContainer width="60%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-3">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: COLORS[d.name] }} />
                <div>
                  <p className="text-xs font-medium">{d.name}</p>
                  <p className="text-lg font-bold">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}