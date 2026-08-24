/**
 * GET /api/system/status
 *
 * Returns the latest bridge heartbeat + the most recent system snapshot.
 * Used by the System Monitor admin page to show live status without a
 * full table query from the client.
 *
 * Access: must be authenticated (Supabase session cookie validated server-side).
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Bridge is "connected" if last_seen is within 20 minutes */
const BRIDGE_TIMEOUT_MS = 20 * 60 * 1000;

export async function GET() {
  // ── Auth: require logged-in user ───────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = getAdminClient();

  // ── Latest heartbeats (all known SNs) ─────────────────────────────────────
  const { data: heartbeats } = await adminClient
    .from('bridge_heartbeats')
    .select('sn, last_seen, ip_address, updated_at')
    .order('last_seen', { ascending: false });

  // ── Latest snapshot ────────────────────────────────────────────────────────
  const { data: snapshots } = await adminClient
    .from('system_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  const latestSnapshot = snapshots?.[0] ?? null;
  const latestHeartbeat = heartbeats?.[0] ?? null;

  // Recompute live bridge status (may differ from last snapshot if bridge
  // reconnected/disconnected between cron ticks)
  const liveBridgeConnected = latestHeartbeat
    ? Date.now() - new Date(latestHeartbeat.last_seen).getTime() < BRIDGE_TIMEOUT_MS
    : false;

  return NextResponse.json({
    bridge: {
      connected: liveBridgeConnected,
      devices: (heartbeats ?? []).map((h) => ({
        sn: h.sn,
        last_seen: h.last_seen,
        ip_address: h.ip_address,
        is_connected: Date.now() - new Date(h.last_seen).getTime() < BRIDGE_TIMEOUT_MS,
      })),
    },
    latest_snapshot: latestSnapshot,
  });
}
