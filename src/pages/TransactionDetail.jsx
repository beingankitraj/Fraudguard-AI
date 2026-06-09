import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MapPin, Smartphone, Clock, DollarSign, User, Hash, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import RiskBadge from '@/components/shared/RiskBadge';
import FraudLabelBadge from '@/components/shared/FraudLabelBadge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

export default function TransactionDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const list = await base44.entities.Transaction.filter({ id });
      return list[0];
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Transaction.update(id, { [field]: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transaction', id] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-muted-foreground mb-4">Transaction not found</p>
        <Button variant="outline" onClick={() => navigate('/Transactions')}>Back to Transactions</Button>
      </div>
    );
  }

  const factors = transaction.contributing_factors || [];
  const factorData = factors.map(f => ({
    name: f.factor,
    impact: Math.round((f.impact || 0) * 100),
  }));

  const infoItems = [
    { icon: Hash, label: 'Transaction ID', value: transaction.transaction_id },
    { icon: User, label: 'User ID', value: transaction.user_id },
    { icon: DollarSign, label: 'Amount', value: `$${(transaction.amount || 0).toLocaleString()}` },
    { icon: FileText, label: 'Type', value: transaction.transaction_type },
    { icon: MapPin, label: 'Location', value: transaction.location },
    { icon: Smartphone, label: 'Device', value: transaction.device_id },
    { icon: Clock, label: 'Timestamp', value: (() => { try { const d = new Date(transaction.timestamp); return isNaN(d) ? '—' : format(d, 'MMM d, yyyy HH:mm:ss'); } catch { return '—'; } })() },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono">{transaction.transaction_id || transaction.id}</h1>
          <p className="text-sm text-muted-foreground">Transaction Detail & Analysis</p>
        </div>
        <RiskBadge level={transaction.risk_level} />
        <FraudLabelBadge label={transaction.fraud_label} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Transaction Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {infoItems.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="w-3 h-3" />
                      {label}
                    </div>
                    <p className="text-sm font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Explanation */}
          {transaction.explanation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Anomaly Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <p className="text-sm leading-relaxed">{transaction.explanation}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contributing Factors Chart */}
          {factorData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Contributing Factors (Feature Importance)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={factorData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(v) => [`${v}%`, 'Impact']}
                      />
                      <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                        {factorData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.impact >= 70 ? 'hsl(0, 84%, 60%)' : entry.impact >= 40 ? 'hsl(38, 92%, 50%)' : 'hsl(var(--primary))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Factor descriptions */}
                <div className="mt-4 space-y-2">
                  {factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{f.factor}:</span>{' '}
                        <span className="text-muted-foreground">{f.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Anomaly Score */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Anomaly Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={
                      (transaction.anomaly_score || 0) >= 0.8 ? 'hsl(0, 84%, 60%)' :
                      (transaction.anomaly_score || 0) >= 0.5 ? 'hsl(38, 92%, 50%)' :
                      'hsl(160, 84%, 39%)'
                    }
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(transaction.anomaly_score || 0) * 251.2} 251.2`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold font-mono">{Math.round((transaction.anomaly_score || 0) * 100)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Review Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={transaction.review_status || 'pending'}
                onValueChange={(value) => updateMutation.mutate({ field: 'review_status', value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="confirmed_fraud">Confirmed Fraud</SelectItem>
                  <SelectItem value="false_positive">False Positive</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${transaction.is_reviewed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {transaction.is_reviewed ? 'Reviewed' : 'Not reviewed'}
              </div>
              {!transaction.is_reviewed && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => updateMutation.mutate({ field: 'is_reviewed', value: true })}
                >
                  Mark as Reviewed
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}