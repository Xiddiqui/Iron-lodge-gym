-- Migration 027: System Monitor — Bridge Heartbeats & Server Snapshots
-- ─────────────────────────────────────────────────────────────────────
-- 1. bridge_heartbeats  — records the last time each device/bridge
--    contacted the server via GET /iclock/cdata handshake.
-- 2. system_snapshots   — one row per cron tick (every 15 min) storing
--    server resource info + bridge connection state.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Bridge Heartbeats
--    One row per device serial number (SN). Upserted on every handshake.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bridge_heartbeats (
  sn           TEXT PRIMARY KEY,
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bridge_heartbeats ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admin/staff) can read heartbeats
CREATE POLICY "Authenticated users can read bridge heartbeats"
  ON public.bridge_heartbeats FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role (API routes) bypasses RLS for INSERT/UPDATE

-- ─────────────────────────────────────────────────────────────────────
-- 2. System Snapshots
--    One row per cron invocation. Keeps a rolling history of server
--    health and bridge status.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_snapshots (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Server environment
  node_version          TEXT,
  next_version          TEXT,
  vercel_region         TEXT,
  vercel_env            TEXT,           -- 'production' | 'preview' | 'development'

  -- Resource usage
  memory_used_mb        NUMERIC(10, 2),
  memory_total_mb       NUMERIC(10, 2),
  process_uptime_s      NUMERIC(14, 2),

  -- Bridge status at snapshot time
  bridge_connected      BOOLEAN NOT NULL DEFAULT FALSE,
  bridge_sn             TEXT,           -- SN of the bridge that was last seen
  bridge_last_seen      TIMESTAMPTZ,    -- when that SN last contacted the server

  -- Optional: self-ping latency from Vercel edge → origin
  server_ping_ms        NUMERIC(10, 2)
);

ALTER TABLE public.system_snapshots ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read snapshots
CREATE POLICY "Authenticated users can read system snapshots"
  ON public.system_snapshots FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Auto-trim: keep only the latest 2000 snapshots
--    A trigger fires after each INSERT to delete old rows.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trim_system_snapshots()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.system_snapshots
  WHERE id IN (
    SELECT id FROM public.system_snapshots
    ORDER BY created_at DESC
    OFFSET 2000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trim_system_snapshots_trigger
  AFTER INSERT ON public.system_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.trim_system_snapshots();
