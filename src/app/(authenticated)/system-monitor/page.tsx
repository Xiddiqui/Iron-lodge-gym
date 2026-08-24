'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Wifi, WifiOff, Server, Cpu, Clock, RefreshCw,
  CheckCircle, XCircle, Monitor, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BridgeDevice {
  sn: string;
  last_seen: string;
  ip_address: string | null;
  is_connected: boolean;
}

interface StatusResponse {
  bridge: {
    connected: boolean;
    devices: BridgeDevice[];
  };
  latest_snapshot: SystemSnapshot | null;
}

interface SystemSnapshot {
  id: string;
  created_at: string;
  node_version: string | null;
  next_version: string | null;
  vercel_region: string | null;
  vercel_env: string | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  process_uptime_s: number | null;
  bridge_connected: boolean;
  bridge_sn: string | null;
  bridge_last_seen: string | null;
  server_ping_ms: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtUptime(seconds: number | null) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtMem(mb: number | null) {
  if (mb == null) return '—';
  return `${mb.toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
        connected
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-red-500/15 text-red-400 border border-red-500/30'
      }`}
    >
      {connected ? (
        <CheckCircle className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-tight truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Custom tooltip for the memory chart
function MemTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{payload[0]?.value?.toFixed(1)} MB used</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SystemMonitorPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch live status ────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setStatus(data);
        setLastRefresh(new Date());
      }
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // ── Fetch snapshot history from Supabase directly ────────────────────────
  const fetchSnapshots = useCallback(async () => {
    const { data } = await supabase
      .from('system_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setSnapshots(data as SystemSnapshot[]);
  }, []);

  useEffect(() => {
    fetchStatus(false);
    fetchSnapshots();
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchStatus(true);
      fetchSnapshots();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchSnapshots]);

  // ── Chart data (chronological) ───────────────────────────────────────────
  const chartData = [...snapshots]
    .reverse()
    .slice(-48) // last 12 hours (48 × 15 min)
    .map((s) => ({
      time: format(new Date(s.created_at), 'HH:mm'),
      mem: s.memory_used_mb ?? 0,
      bridge: s.bridge_connected ? 1 : 0,
    }));

  const snap = status?.latest_snapshot;
  const bridge = status?.bridge;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">System Monitor</h1>
            <p className="text-sm text-muted-foreground">
              Server health &amp; bridge connectivity — auto-refreshes every 60 s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { fetchStatus(false); fetchSnapshots(); }}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          {/* ── Bridge Status Card ────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Wifi className="h-4 w-4" /> Bridge &amp; Device Status
            </h2>
            {bridge?.devices.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No devices have contacted the server yet.
                <br />
                Start the bridge script or power on the K50 device to see status here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bridge?.devices.map((device) => (
                  <motion.div
                    key={device.sn}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-xl border p-5 space-y-3 ${
                      device.is_connected
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {device.is_connected ? (
                          <Wifi className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-red-400" />
                        )}
                        <span className="font-semibold text-sm font-mono">{device.sn}</span>
                      </div>
                      <StatusBadge connected={device.is_connected} />
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium">Last seen: </span>
                        {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
                      </p>
                      <p>
                        <span className="font-medium">Exact time: </span>
                        {format(new Date(device.last_seen), 'dd MMM yyyy, HH:mm:ss')}
                      </p>
                      {device.ip_address && (
                        <p>
                          <span className="font-medium">IP: </span>
                          {device.ip_address}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>

          {/* ── Latest Server Snapshot ─────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Server className="h-4 w-4" /> Latest Server Snapshot
            </h2>
            {snap ? (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  icon={Server}
                  label="Node.js"
                  value={snap.node_version ?? '—'}
                  sub={`Next.js ${snap.next_version ?? '—'}`}
                />
                <StatCard
                  icon={Activity}
                  label="Region"
                  value={snap.vercel_region ?? 'Local'}
                  sub={snap.vercel_env ?? ''}
                />
                <StatCard
                  icon={Cpu}
                  label="Heap Used"
                  value={fmtMem(snap.memory_used_mb)}
                  sub={`of ${fmtMem(snap.memory_total_mb)}`}
                />
                <StatCard
                  icon={Clock}
                  label="Uptime"
                  value={fmtUptime(snap.process_uptime_s)}
                />
                <StatCard
                  icon={Database}
                  label="Snapshot"
                  value={format(new Date(snap.created_at), 'HH:mm')}
                  sub={format(new Date(snap.created_at), 'dd MMM yyyy')}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                No snapshots yet. The first one will be recorded in the next cron cycle (every 15 min).
                <br />
                You can also trigger one manually via:{' '}
                <code className="text-xs bg-muted px-1 rounded">
                  POST /api/system/snapshot
                </code>
              </div>
            )}
          </motion.section>

          {/* ── Memory Chart ─────────────────────────────────────────────────── */}
          {chartData.length > 1 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4" /> Memory Usage — Last 12 Hours
              </h2>
              <div className="rounded-xl border bg-card p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      unit=" MB"
                      width={55}
                    />
                    <Tooltip content={<MemTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="mem"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          )}

          {/* ── Snapshot History Table ────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Snapshot History ({snapshots.length} records)
            </h2>
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Bridge</th>
                      <th className="px-4 py-3 text-left">Bridge SN</th>
                      <th className="px-4 py-3 text-left">Memory</th>
                      <th className="px-4 py-3 text-left">Uptime</th>
                      <th className="px-4 py-3 text-left">Region</th>
                      <th className="px-4 py-3 text-left">Node</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {snapshots.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          No snapshots recorded yet.
                        </td>
                      </tr>
                    ) : (
                      snapshots.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs">
                            {format(new Date(s.created_at), 'dd MMM HH:mm')}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge connected={s.bridge_connected} />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {s.bridge_sn ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {fmtMem(s.memory_used_mb)}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {fmtUptime(s.process_uptime_s)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {s.vercel_region ?? 'Local'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {s.node_version ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        </>
      )}
    </div>
  );
}
