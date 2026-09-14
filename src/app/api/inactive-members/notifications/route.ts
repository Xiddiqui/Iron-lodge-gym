import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && serviceRoleKey !== 'your_service_role_key') {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: notifications, error } = await adminClient
      .from('inactive_member_notifications')
      .select('*')
      .order('check_in_time', { ascending: false })
      .limit(100);

    if (error) {
      // If table doesn't exist yet, return empty list
      return NextResponse.json({
        notifications: [],
        unclearedCount: 0,
      });
    }

    const unclearedCount = (notifications || []).filter((n) => !n.is_cleared).length;

    return NextResponse.json({
      notifications: notifications || [],
      unclearedCount,
    });
  } catch (err: any) {
    console.error('[API Inactive Notifications Error]:', err);
    return NextResponse.json({ notifications: [], unclearedCount: 0 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, clearAll } = body;

    const now = new Date().toISOString();

    if (clearAll) {
      const { error } = await adminClient
        .from('inactive_member_notifications')
        .update({ is_cleared: true, cleared_at: now })
        .eq('is_cleared', false);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'All notifications cleared' });
    }

    if (id) {
      const { error } = await adminClient
        .from('inactive_member_notifications')
        .update({ is_cleared: true, cleared_at: now })
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Notification cleared' });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[API Clear Inactive Notifications Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      const { error } = await adminClient
        .from('inactive_member_notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All notifications deleted' });
    }

    if (id) {
      const { error } = await adminClient
        .from('inactive_member_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Notification deleted' });
    }

    return NextResponse.json({ error: 'Missing id or clearAll parameter' }, { status: 400 });
  } catch (err: any) {
    console.error('[API Delete Inactive Notification Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete notification' }, { status: 500 });
  }
}
