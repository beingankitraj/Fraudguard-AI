import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfDay } from 'date-fns';
import _ from 'lodash';

export default function TimeSeriesChart({ transactions }) {
  const groupedByDate = _.groupBy(transactions, t => {
    const raw = t.timestamp || t.created_date;
    const d = raw ? new Date(raw) : null;
    if (!d || isNaN(d)) return '__invalid__';
    return format(startOfDay(d), 'yyyy-MM-dd');
  });

  const data = Object.entries(groupedByDate)
    .filter(([date]) => date !== '__invalid__')
    .map(([date, txns]) => ({
      date,
      total: txns.length,
      flagged: txns.filter(t => t.fraud_label !== 'Normal').length,
      avgScore: txns.reduce((sum, t) => sum + (t.anomaly_score || 0), 0) / txns.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Transaction Trends (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="flaggedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }}
              />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(v) => { try { return format(new Date(v), 'MMM d, yyyy'); } catch { return v; } }}
              />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#totalGrad)" strokeWidth={2} name="Total" />
              <Area type="monotone" dataKey="flagged" stroke="hsl(0, 84%, 60%)" fill="url(#flaggedGrad)" strokeWidth={2} name="Flagged" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}