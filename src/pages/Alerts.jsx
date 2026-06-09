import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, CheckCircle, XCircle, Search as SearchIcon, AlertTriangle, ShieldAlert, Zap, MapPin, Smartphone, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const alertTypeConfig = {
  unusual_amount: { label: 'Unusual Amount', icon: TrendingUp, color: 'text-amber-500' },
  rapid_transactions: { label: 'Rapid Transactions', icon: Zap, color: 'text-red-500' },
  location_mismatch: { label: 'Location Mismatch', icon: MapPin, color: 'text-violet-500' },
  device_mismatch: { label: 'Device Mismatch', icon: Smartphone, color: 'text-blue-500' },
  behavioral_deviation: { label: 'Behavioral Deviation', icon: AlertTriangle, color: 'text-amber-500' },
  velocity_spike: { label: 'Velocity Spike', icon: Zap, color: 'text-red-500' },
  pattern_anomaly: { label: 'Pattern Anomaly', icon: ShieldAlert, color: 'text-red-500' },
};

const severityColors = {
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
  critical: 'bg-red-500/20 text-red-500 border-red-500/30',
};

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: () => base44.entities.FraudAlert.list('-created_date', 200),
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FraudAlert.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] }),
  });

  const filtered = alerts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  const openCount = alerts.filter(a => a.status === 'open').length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fraud Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {openCount} open alerts{criticalCount > 0 && `, ${criticalCount} critical`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No alerts found</p>
          </div>
        ) : (
          filtered.map(alert => {
            const typeConf = alertTypeConfig[alert.alert_type] || alertTypeConfig.pattern_anomaly;
            const TypeIcon = typeConf.icon;

            return (
              <Card key={alert.id} className={`transition-all hover:shadow-md ${alert.status === 'open' ? 'border-l-4 border-l-red-500' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg bg-muted ${typeConf.color}`}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold">{typeConf.label}</p>
                        <Badge variant="outline" className={`${severityColors[alert.severity]} border text-[10px]`}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{alert.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{alert.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>TXN: {alert.transaction_id}</span>
                        {alert.user_id && <span>User: {alert.user_id}</span>}
                        {alert.amount && <span>${alert.amount.toLocaleString()}</span>}
                        <span>{format(new Date(alert.created_date), 'MMM d, HH:mm')}</span>
                      </div>
                    </div>
                    {alert.status === 'open' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: alert.id, data: { status: 'investigating' } })}
                        >
                          Investigate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateMutation.mutate({ id: alert.id, data: { status: 'dismissed' } })}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {alert.status === 'investigating' && (
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: alert.id, data: { status: 'resolved' } })}
                        className="gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}