import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import RiskBadge from '@/components/shared/RiskBadge';
import FraudLabelBadge from '@/components/shared/FraudLabelBadge';
import AnomalyScoreBar from '@/components/shared/AnomalyScoreBar';
import { format, parseISO } from 'date-fns';

export default function TopSuspiciousTable({ transactions }) {
  const top = [...transactions]
    .sort((a, b) => (b.anomaly_score || 0) - (a.anomaly_score || 0))
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Top Suspicious Transactions</CardTitle>
          <Link to="/Transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Transaction</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Score</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map(t => (
                <TableRow key={t.id} className="group cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/TransactionDetail?id=${t.id}`} className="font-mono text-xs text-primary hover:underline">
                      {t.transaction_id || t.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-semibold">${(t.amount || 0).toLocaleString()}</TableCell>
                  <TableCell><AnomalyScoreBar score={t.anomaly_score} /></TableCell>
                  <TableCell><RiskBadge level={t.risk_level} /></TableCell>
                  <TableCell><FraudLabelBadge label={t.fraud_label} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(() => { try { const d = new Date(t.timestamp); return isNaN(d) ? '—' : format(d, 'MMM d, HH:mm'); } catch { return '—'; } })()}
                  </TableCell>
                </TableRow>
              ))}
              {top.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                    No transactions analyzed yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}