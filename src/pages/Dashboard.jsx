import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import AnomalyDistributionChart from '@/components/dashboard/AnomalyDistributionChart';
import TimeSeriesChart from '@/components/dashboard/TimeSeriesChart';
import RiskBreakdownChart from '@/components/dashboard/RiskBreakdownChart';
import TopSuspiciousTable from '@/components/dashboard/TopSuspiciousTable';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

function DatasetDashboard({ transactions }) {
  const totalTxns = transactions.length;
  const fraudCount = transactions.filter(t => t.fraud_label === 'Fraud').length;
  const suspiciousCount = transactions.filter(t => t.fraud_label === 'Suspicious').length;
  const avgScore = totalTxns > 0
    ? (transactions.reduce((sum, t) => sum + (t.anomaly_score || 0), 0) / totalTxns).toFixed(3)
    : '0.000';

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Transactions" value={totalTxns.toLocaleString()} icon={Activity} />
        <StatCard title="Fraud Detected" value={fraudCount} subtitle={`${totalTxns > 0 ? ((fraudCount / totalTxns) * 100).toFixed(1) : 0}% of total`} icon={Shield} />
        <StatCard title="Suspicious" value={suspiciousCount} icon={AlertTriangle} />
        <StatCard title="Avg Anomaly Score" value={avgScore} icon={TrendingUp} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnomalyDistributionChart transactions={transactions} />
        <RiskBreakdownChart transactions={transactions} />
      </div>
      <TimeSeriesChart transactions={transactions} />
      <TopSuspiciousTable transactions={transactions} />
    </div>
  );
}

export default function Dashboard() {
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 500),
    initialData: [],
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['all-runs'],
    queryFn: () => base44.entities.AnalysisRun.list('-created_date', 100),
    initialData: [],
  });

  const isLoading = txLoading || runsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      </div>
    );
  }

  // Group transactions by analysis_run_id
  const txByRun = {};
  transactions.forEach(t => {
    const key = t.analysis_run_id || '__untagged__';
    if (!txByRun[key]) txByRun[key] = [];
    txByRun[key].push(t);
  });

  // Build tab list: completed runs that have transactions, sorted newest first
  const tabRuns = runs.filter(r => txByRun[r.id] && txByRun[r.id].length > 0);
  const untagged = txByRun['__untagged__'] || [];

  const hasTabs = tabRuns.length > 0 || untagged.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fraud Detection Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Select a dataset tab to view its analysis</p>
      </div>

      {!hasTabs ? (
        <div className="text-center py-20 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No datasets yet</p>
          <p className="text-sm mt-1">Upload a transaction file to get started.</p>
        </div>
      ) : (
        <Tabs defaultValue={tabRuns[0]?.id || '__untagged__'}>
          <TabsList className="flex-wrap h-auto gap-1">
            {tabRuns.map(run => (
              <TabsTrigger key={run.id} value={run.id} className="gap-2 text-xs">
                {run.name}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{txByRun[run.id].length}</Badge>
              </TabsTrigger>
            ))}
            {untagged.length > 0 && (
              <TabsTrigger value="__untagged__" className="gap-2 text-xs">
                Untagged
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{untagged.length}</Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {tabRuns.map(run => (
            <TabsContent key={run.id} value={run.id}>
              <DatasetDashboard transactions={txByRun[run.id]} />
            </TabsContent>
          ))}
          {untagged.length > 0 && (
            <TabsContent value="__untagged__">
              <DatasetDashboard transactions={untagged} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}