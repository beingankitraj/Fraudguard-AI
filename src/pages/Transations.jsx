import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import RiskBadge from '@/components/shared/RiskBadge';
import FraudLabelBadge from '@/components/shared/FraudLabelBadge';
import AnomalyScoreBar from '@/components/shared/AnomalyScoreBar';
import { Skeleton } from '@/components/ui/skeleton';

export default function Transactions() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score_desc');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions-list'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 500),
    initialData: [],
  });

  const filtered = useMemo(() => {
    let result = [...transactions];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.transaction_id || '').toLowerCase().includes(q) ||
        (t.user_id || '').toLowerCase().includes(q) ||
        (t.merchant || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q)
      );
    }

    if (riskFilter !== 'all') {
      result = result.filter(t => t.risk_level === riskFilter);
    }

    if (labelFilter !== 'all') {
      result = result.filter(t => t.fraud_label === labelFilter);
    }

    switch (sortBy) {
      case 'score_desc': result.sort((a, b) => (b.anomaly_score || 0) - (a.anomaly_score || 0)); break;
      case 'score_asc': result.sort((a, b) => (a.anomaly_score || 0) - (b.anomaly_score || 0)); break;
      case 'amount_desc': result.sort((a, b) => (b.amount || 0) - (a.amount || 0)); break;
      case 'amount_asc': result.sort((a, b) => (a.amount || 0) - (b.amount || 0)); break;
      case 'date_desc': result.sort((a, b) => new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date)); break;
    }

    return result;
  }, [transactions, search, riskFilter, labelFilter, sortBy]);

  const handleExport = () => {
    const csv = [
      'Transaction ID,User ID,Amount,Risk Level,Fraud Label,Anomaly Score,Location,Date',
      ...filtered.map(t =>
        `${t.transaction_id},${t.user_id},${t.amount},${t.risk_level},${t.fraud_label},${t.anomaly_score},${t.location},${t.timestamp}`
      )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {transactions.length} transactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, user, merchant, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Risk Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Label" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Labels</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Suspicious">Suspicious</SelectItem>
                <SelectItem value="Fraud">Fraud</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score_desc">Score (High → Low)</SelectItem>
                <SelectItem value="score_asc">Score (Low → High)</SelectItem>
                <SelectItem value="amount_desc">Amount (High → Low)</SelectItem>
                <SelectItem value="amount_asc">Amount (Low → High)</SelectItem>
                <SelectItem value="date_desc">Most Recent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Transaction ID</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Score</TableHead>
                  <TableHead className="text-xs">Risk</TableHead>
                  <TableHead className="text-xs">Label</TableHead>
                  <TableHead className="text-xs">Location</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      {Array(9).fill(0).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  filtered.map(t => (
                    <TableRow key={t.id} className="hover:bg-muted/50 cursor-pointer">
                      <TableCell>
                        <Link to={`/TransactionDetail?id=${t.id}`} className="font-mono text-xs text-primary hover:underline">
                          {t.transaction_id || t.id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{t.user_id || '—'}</TableCell>
                      <TableCell className="font-mono text-sm font-semibold">${(t.amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs capitalize">{t.transaction_type || '—'}</TableCell>
                      <TableCell><AnomalyScoreBar score={t.anomaly_score} /></TableCell>
                      <TableCell><RiskBadge level={t.risk_level} /></TableCell>
                      <TableCell><FraudLabelBadge label={t.fraud_label} /></TableCell>
                      <TableCell className="text-xs">{t.location || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(() => { try { const d = new Date(t.timestamp); return isNaN(d) ? '—' : format(d, 'MMM d, HH:mm'); } catch { return '—'; } })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}