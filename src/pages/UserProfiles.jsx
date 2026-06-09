import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import _ from 'lodash';
import RiskBadge from '@/components/shared/RiskBadge';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserProfiles() {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['user-profiles-txns'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 500),
    initialData: [],
  });

  const userProfiles = useMemo(() => {
    const grouped = _.groupBy(transactions, 'user_id');
    return Object.entries(grouped).map(([userId, txns]) => {
      const totalAmount = txns.reduce((s, t) => s + (t.amount || 0), 0);
      const avgAmount = totalAmount / txns.length;
      const avgScore = txns.reduce((s, t) => s + (t.anomaly_score || 0), 0) / txns.length;
      const fraudCount = txns.filter(t => t.fraud_label === 'Fraud').length;
      const suspiciousCount = txns.filter(t => t.fraud_label === 'Suspicious').length;
      const locations = [...new Set(txns.map(t => t.location).filter(Boolean))];
      const devices = [...new Set(txns.map(t => t.device_id).filter(Boolean))];
      const highestRisk = txns.reduce((max, t) => {
        const order = { normal: 0, low: 1, medium: 2, high: 3, critical: 4 };
        return (order[t.risk_level] || 0) > (order[max] || 0) ? t.risk_level : max;
      }, 'normal');

      return {
        userId: userId || 'Unknown',
        txnCount: txns.length,
        totalAmount,
        avgAmount,
        avgScore,
        fraudCount,
        suspiciousCount,
        highestRisk,
        locations,
        devices,
        transactions: txns,
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [transactions]);

  const filteredProfiles = search
    ? userProfiles.filter(p => p.userId.toLowerCase().includes(search.toLowerCase()))
    : userProfiles;

  const selectedProfile = selectedUser
    ? userProfiles.find(p => p.userId === selectedUser)
    : null;

  const userAmountData = selectedProfile
    ? selectedProfile.transactions
        .sort((a, b) => new Date(a.timestamp || a.created_date) - new Date(b.timestamp || b.created_date))
        .map((t, i) => ({ idx: i + 1, amount: t.amount || 0, score: Math.round((t.anomaly_score || 0) * 100) }))
    : [];

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Profiles</h1>
        <p className="text-sm text-muted-foreground mt-1">Behavioral analysis per user</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User list */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredProfiles.map(p => (
              <Card
                key={p.userId}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedUser === p.userId ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedUser(p.userId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{p.userId}</p>
                        <p className="text-xs text-muted-foreground">{p.txnCount} transactions</p>
                      </div>
                    </div>
                    <RiskBadge level={p.highestRisk} showIcon={false} />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>${p.totalAmount.toLocaleString()} total</span>
                    {p.fraudCount > 0 && <span className="text-red-500">{p.fraudCount} fraud</span>}
                    {p.suspiciousCount > 0 && <span className="text-amber-500">{p.suspiciousCount} suspicious</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProfiles.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">No users found</p>
            )}
          </div>
        </div>

        {/* User detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedProfile ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedProfile.userId} — Profile Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">{selectedProfile.txnCount}</p>
                      <p className="text-xs text-muted-foreground">Transactions</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">${selectedProfile.avgAmount.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">Avg Amount</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">{(selectedProfile.avgScore * 100).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-xl font-bold">{selectedProfile.locations.length}</p>
                      <p className="text-xs text-muted-foreground">Locations</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedProfile.locations.map(l => (
                      <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                    ))}
                    {selectedProfile.devices.map(d => (
                      <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Transaction Amount History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={userAmountData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="idx" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(v, name) => [name === 'amount' ? `$${v}` : `${v}%`, name === 'amount' ? 'Amount' : 'Score']}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a user to view their profile</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}