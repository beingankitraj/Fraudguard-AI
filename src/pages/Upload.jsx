import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload as UploadIcon, FileText, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

// Parse CSV text into array of objects
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] !== undefined ? values[i].replace(/^"|"$/g, '') : ''; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

// Parse JSON file into array of objects
function parseJSON(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  // Find first array property
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) return val;
  }
  return [data];
}

// Read file as text in browser
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Map arbitrary column names to standard fields
function normalizeRow(row, idx) {
  const keys = Object.keys(row);
  const get = (...candidates) => {
    for (const c of candidates) {
      const match = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === c.replace(/[^a-z0-9]/g, ''));
      if (match !== undefined && row[match] !== undefined && String(row[match]).trim() !== '') return row[match];
    }
    return null;
  };

  return {
    transaction_id: String(get('transactionid', 'txnid', 'txid', 'id', 'transaction_id', 'transid') || `TXN-${Date.now()}-${idx}`),
    user_id: get('userid', 'user_id', 'customerid', 'customer_id', 'accountid', 'account_id', 'clientid', 'nameorig'),
    amount: parseFloat(get('amount', 'amt', 'value', 'sum', 'total', 'price', 'transactionamount') || 0),
    timestamp: get('timestamp', 'date', 'datetime', 'time', 'createdat', 'created_at', 'transactiondate', 'txndate', 'step'),
    location: get('location', 'city', 'country', 'region', 'place', 'address'),
    device_id: get('deviceid', 'device_id', 'device', 'devicetype'),
    transaction_type: get('transactiontype', 'transaction_type', 'type', 'category', 'txntype'),
    merchant: get('merchant', 'merchantname', 'vendor', 'store', 'shop', 'payee', 'receiver', 'to', 'namedest'),
    ip_address: get('ipaddress', 'ip_address', 'ip'),
  };
}

// Fast statistical fraud scoring
function scoreStatistically(txn, mean, std) {
  const amount = txn.amount || 0;
  const zScore = std > 0 ? Math.abs(amount - mean) / std : 0;
  const factors = [];
  let score = 0;

  if (zScore > 3) {
    score += 0.5;
    factors.push({ factor: 'Amount Deviation', impact: Math.min(0.95, zScore / 6), description: `Amount ${zScore.toFixed(1)}x std devs from mean` });
  } else if (zScore > 2) {
    score += 0.25;
    factors.push({ factor: 'Amount Deviation', impact: 0.4, description: 'Amount above average' });
  }
  if (txn.timestamp) {
    const hour = new Date(txn.timestamp).getHours();
    if (!isNaN(hour) && hour >= 1 && hour <= 5) {
      score += 0.25;
      factors.push({ factor: 'Time Anomaly', impact: 0.6, description: `Unusual hour: ${hour}:00` });
    }
  }
  if (amount >= 4500 && amount < 5000) {
    score += 0.3;
    factors.push({ factor: 'Structuring', impact: 0.75, description: 'Just below $5k threshold' });
  }
  if (amount > 10000) {
    score += 0.2;
    factors.push({ factor: 'High Value', impact: 0.5, description: `High value: $${amount.toLocaleString()}` });
  }

  const finalScore = Math.min(0.99, score);
  let risk_level = 'normal', fraud_label = 'Normal';
  if (finalScore >= 0.75) { risk_level = 'critical'; fraud_label = 'Fraud'; }
  else if (finalScore >= 0.55) { risk_level = 'high'; fraud_label = 'Fraud'; }
  else if (finalScore >= 0.35) { risk_level = 'medium'; fraud_label = 'Suspicious'; }
  else if (finalScore >= 0.2) { risk_level = 'low'; fraud_label = 'Suspicious'; }

  return {
    anomaly_score: parseFloat(finalScore.toFixed(3)),
    risk_level,
    fraud_label,
    explanation: factors.length > 0 ? `Flagged: ${factors.map(f => f.description).join('; ')}.` : 'Normal transaction based on statistical analysis.',
    contributing_factors: factors,
  };
}

export default function Upload() {
  const [file, setFile] = useState(null);
  const [analysisName, setAnalysisName] = useState('');
  const [mode, setMode] = useState('unsupervised');
  const [step, setStep] = useState('upload');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileRef = useRef(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setStep('analyzing');
      setProgress(5);
      setStatusMsg('Reading file...');

      // Step 1: Parse file directly in browser (no API call needed)
      let rawRows = [];
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'csv') {
        const text = await readFileAsText(file);
        rawRows = parseCSV(text);
      } else if (ext === 'json') {
        const text = await readFileAsText(file);
        rawRows = parseJSON(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        // For Excel, upload and use ExtractDataFromUploadedFile as fallback
        setStatusMsg('Uploading Excel file...');
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setProgress(15);
        setStatusMsg('Extracting Excel data...');
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: 'object',
            properties: {
              rows: { type: 'array', items: { type: 'object', additionalProperties: true } }
            }
          }
        });
        if (result.status === 'error') throw new Error(`Excel extraction failed: ${result.details}`);
        rawRows = result.output?.rows || [];
        if (!Array.isArray(rawRows)) {
          const arrays = Object.values(result.output || {}).filter(v => Array.isArray(v));
          rawRows = arrays.length > 0 ? arrays[0] : [];
        }
      } else {
        throw new Error('Unsupported file type. Please upload CSV, JSON, XLSX, or XLS.');
      }

      if (rawRows.length === 0) throw new Error('No data rows found in the file. Check that the file is not empty.');

      setProgress(30);
      setStatusMsg(`Processing ${rawRows.length.toLocaleString()} records...`);

      // Step 2: Normalize columns
      const normalized = rawRows.map((row, idx) => normalizeRow(row, idx));

      // Step 3: Create analysis run
      const analysisRun = await base44.entities.AnalysisRun.create({
        name: analysisName || `Analysis ${new Date().toLocaleDateString()}`,
        status: 'running',
        mode,
        total_transactions: normalized.length,
        methods_used: ['Z-Score Analysis', 'Threshold Detection', 'Timing Analysis', 'AI Pattern Recognition'],
      });

      setProgress(40);
      setStatusMsg('Running statistical anomaly detection...');

      // Step 4: Statistical scoring (all records, instant, no API)
      const amounts = normalized.map(r => r.amount).filter(a => a > 0);
      const mean = amounts.length ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
      const std = amounts.length ? Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length) : 0;
      const scored = normalized.map(r => ({ ...r, ...scoreStatistically(r, mean, std) }));

      setProgress(60);
      setStatusMsg('Running AI analysis on top suspicious transactions...');

      // Step 5: Optional LLM enhancement on small sample only
      try {
        const topFlagged = scored.filter(r => r.fraud_label !== 'Normal').slice(0, 10);
        if (topFlagged.length > 0) {
          const llmSample = topFlagged.map((t, i) => ({
            idx: i,
            transaction_id: t.transaction_id,
            amount: t.amount,
            timestamp: t.timestamp,
            transaction_type: t.transaction_type,
            merchant: t.merchant,
            location: t.location,
          }));
          const llmResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Fraud analyst. Review these ${llmSample.length} flagged transactions and refine: anomaly_score (0-1), risk_level (normal/low/medium/high/critical), fraud_label (Normal/Suspicious/Fraud), explanation (max 120 chars), contributing_factors (max 2: [{factor, impact, description}]). Data: ${JSON.stringify(llmSample)}`,
            response_json_schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      idx: { type: 'number' },
                      anomaly_score: { type: 'number' },
                      risk_level: { type: 'string' },
                      fraud_label: { type: 'string' },
                      explanation: { type: 'string' },
                      contributing_factors: { type: 'array', items: { type: 'object', properties: { factor: { type: 'string' }, impact: { type: 'number' }, description: { type: 'string' } } } }
                    }
                  }
                }
              }
            }
          });
          const llmResults = llmResult?.results || [];
          const llmMap = {};
          topFlagged.forEach((t, i) => { llmMap[t.transaction_id] = llmResults[i]; });
          scored.forEach((t, i) => {
            if (llmMap[t.transaction_id]) scored[i] = { ...t, ...llmMap[t.transaction_id] };
          });
        }
      } catch (e) {
        console.warn('LLM step skipped:', e.message);
      }

      setProgress(75);
      setStatusMsg('Saving to database...');

      // Step 6: Prepare trimmed records
      const toCreate = scored.map(t => ({
        transaction_id: String(t.transaction_id).slice(0, 100),
        user_id: t.user_id ? String(t.user_id).slice(0, 100) : null,
        amount: t.amount || 0,
        timestamp: t.timestamp ? String(t.timestamp).slice(0, 50) : null,
        location: t.location ? String(t.location).slice(0, 100) : null,
        device_id: t.device_id ? String(t.device_id).slice(0, 50) : null,
        transaction_type: t.transaction_type ? String(t.transaction_type).slice(0, 50) : null,
        merchant: t.merchant ? String(t.merchant).slice(0, 100) : null,
        ip_address: t.ip_address ? String(t.ip_address).slice(0, 50) : null,
        anomaly_score: t.anomaly_score || 0,
        risk_level: t.risk_level || 'normal',
        fraud_label: t.fraud_label || 'Normal',
        explanation: (t.explanation || '').slice(0, 300),
        contributing_factors: (t.contributing_factors || []).slice(0, 3).map(f => ({
          factor: String(f.factor || '').slice(0, 60),
          impact: Number(f.impact) || 0,
          description: String(f.description || '').slice(0, 150),
        })),
        analysis_run_id: analysisRun.id,
        is_reviewed: false,
        review_status: 'pending',
      }));

      // Save in sequential chunks of 10 to stay well under BSON limit
      const CHUNK = 10;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        await base44.entities.Transaction.bulkCreate(toCreate.slice(i, i + CHUNK));
        setProgress(75 + Math.round(((i + CHUNK) / toCreate.length) * 18));
      }

      setProgress(94);
      setStatusMsg('Creating alerts...');

      // Step 7: Alerts for high-risk
      const highRisk = toCreate.filter(t => t.risk_level === 'high' || t.risk_level === 'critical');
      if (highRisk.length > 0) {
        const alertBatches = [];
        for (let i = 0; i < highRisk.length; i += 20) alertBatches.push(highRisk.slice(i, i + 20));
        for (const batch of alertBatches) {
          await base44.entities.FraudAlert.bulkCreate(batch.map(t => ({
            transaction_id: t.transaction_id,
            user_id: t.user_id,
            alert_type: 'pattern_anomaly',
            severity: t.risk_level === 'critical' ? 'critical' : 'high',
            description: (t.explanation || '').slice(0, 200),
            anomaly_score: t.anomaly_score,
            amount: t.amount,
            status: 'open',
          })));
        }
      }

      // Step 8: Finalize analysis run
      const fraudCount = toCreate.filter(t => t.fraud_label === 'Fraud').length;
      const suspiciousCount = toCreate.filter(t => t.fraud_label === 'Suspicious').length;
      await base44.entities.AnalysisRun.update(analysisRun.id, {
        status: 'completed',
        flagged_count: fraudCount + suspiciousCount,
        fraud_count: fraudCount,
        suspicious_count: suspiciousCount,
        normal_count: toCreate.length - fraudCount - suspiciousCount,
        summary: `Analyzed ${toCreate.length} transactions. Found ${fraudCount} fraud and ${suspiciousCount} suspicious.`,
      });

      setProgress(100);
      return { total: toCreate.length, fraud: fraudCount, suspicious: suspiciousCount, alerts: highRisk.length };
    },
    onSuccess: (result) => {
      setAnalysisResult(result);
      setStep('complete');
      queryClient.invalidateQueries();
      toast({ title: 'Analysis Complete', description: `${result.total} transactions analyzed.` });
    },
    onError: (error) => {
      setStep('upload');
      setProgress(0);
      toast({ title: 'Analysis Failed', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Upload & Analyze</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload any transaction dataset — CSV, JSON, or Excel — for fraud detection</p>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Transaction Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files[0];
                  if (selected && selected.size > 500 * 1024 * 1024) {
                    toast({ title: 'File too large', description: 'Maximum file size is 500 MB.', variant: 'destructive' });
                    e.target.value = '';
                    return;
                  }
                  setFile(selected);
                }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadIcon className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Drop your file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">CSV, JSON, or Excel · Max 500 MB</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <p className="font-medium mb-1">Works with any dataset format</p>
              <p>Automatically detects columns like <code>amount</code>, <code>date</code>, <code>user_id</code>, <code>merchant</code>, <code>type</code>, etc.</p>
            </div>

            <div className="space-y-2">
              <Label>Analysis Name (optional)</Label>
              <Input
                placeholder="e.g., March 2026 Batch"
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Detection Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unsupervised">Unsupervised (No labels needed)</SelectItem>
                  <SelectItem value="supervised">Supervised (With fraud labels)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full gap-2" size="lg" disabled={!file} onClick={() => analyzeMutation.mutate()}>
              <Sparkles className="w-4 h-4" />
              Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'analyzing' && (
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <div>
              <p className="text-lg font-semibold">Analyzing Dataset</p>
              <p className="text-sm text-muted-foreground mt-1">{statusMsg}</p>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progress}% complete</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && analysisResult && (
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
            <div>
              <p className="text-lg font-semibold">Analysis Complete</p>
              <p className="text-sm text-muted-foreground mt-1">Your dataset has been analyzed for fraud</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{analysisResult.total}</p>
                <p className="text-xs text-muted-foreground">Total Analyzed</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <p className="text-2xl font-bold text-red-500">{analysisResult.fraud}</p>
                <p className="text-xs text-muted-foreground">Fraud Detected</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{analysisResult.suspicious}</p>
                <p className="text-xs text-muted-foreground">Suspicious</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">{analysisResult.alerts}</p>
                <p className="text-xs text-muted-foreground">Alerts Created</p>
              </div>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => navigate('/Dashboard')}>View Dashboard</Button>
              <Button variant="outline" onClick={() => navigate('/Transactions')}>View Transactions</Button>
              <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setAnalysisResult(null); setProgress(0); }}>
                Analyze More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}