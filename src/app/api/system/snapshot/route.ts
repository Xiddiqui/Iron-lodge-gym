/**
 * POST /api/system/snapshot
 *
 * Called by Vercel Cron every 15 minutes (defined in vercel.json).
 * Protected by a shared secret in the Authorization header.
 *
 * Collects server metrics + bridge connectivity, writes a row to
 * the system_snapshots table.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Next.js version baked in at build time
import { version as NEXT_VERSION } from 'next/package.json';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** True if the given ISO timestamp is within the last `thresholdMs` ms */
function isRecent(isoString: string | null | undefined, thresholdMs: number): boolean {
  if (!isoString) return false;
  return Date.now() - new Date(isoString).getTime() < thresholdMs;
}

export async function POST(request: Request) {
  // ── Auth: verify cron secret ───────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    // Vercel Cron also sends the secret via x-vercel-cron header
    const vercelCron = request.headers.get('x-vercel-cron') ?? '';
    if (token !== cronSecret && vercelCron !== '1') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const adminClient = getAdminClient();

  // ── Memory usage ───────────────────────────────────────────────────────────
  const mem = process.memoryUsage();
  const memUsedMb = mem.heapUsed / 1024 / 1024;
  const memTotalMb = mem.heapTotal / 1024 / 1024;

  // ── Process uptime ────────────────────────────────────────────────────────
  const uptimeSeconds = process.uptime();

  // ── Bridge status: find the most-recently-seen heartbeat ─────────────────
  // Bridge is "connected" if any SN was seen within the last 20 minutes
  const BRIDGE_TIMEOUT_MS = 20 * 60 * 1000;

  const { data: heartbeats } = await adminClient
    .from('bridge_heartbeats')
    .select('sn, last_seen')
    .order('last_seen', { ascending: false })
    .limit(1);

  const latestHeartbeat = heartbeats?.[0];
  const bridgeConnected = isRecent(latestHeartbeat?.last_seen, BRIDGE_TIMEOUT_MS);

  // ── Insert snapshot ───────────────────────────────────────────────────────
  const { error } = await adminClient.from('system_snapshots').insert({
    node_version: process.version,
    next_version: NEXT_VERSION,
    vercel_region: process.env.VERCEL_REGION ?? process.env.VERCEL_EDGE_CONFIG ?? null,
    vercel_env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    memory_used_mb: parseFloat(memUsedMb.toFixed(2)),
    memory_total_mb: parseFloat(memTotalMb.toFixed(2)),
    process_uptime_s: parseFloat(uptimeSeconds.toFixed(2)),
    bridge_connected: bridgeConnected,
    bridge_sn: latestHeartbeat?.sn ?? null,
    bridge_last_seen: latestHeartbeat?.last_seen ?? null,
    server_ping_ms: null, // Vercel doesn't expose a self-ping mechanism simply
  });

  if (error) {
    console.error('[SystemMonitor] Failed to insert snapshot:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[SystemMonitor] Snapshot saved — bridge: ${bridgeConnected ? 'connected' : 'disconnected'}, mem: ${memUsedMb.toFixed(1)} MB`);
  return NextResponse.json({ ok: true, bridge_connected: bridgeConnected });
}
