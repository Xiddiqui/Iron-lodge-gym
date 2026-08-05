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

function diffMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  return Math.round((end - start) / (1000 * 60));
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    // Fetch non-admin staff profiles
    const { data: profiles, error: pError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name');

    if (pError || !profiles) {
      return NextResponse.json({ error: pError?.message || 'Failed to fetch profiles' }, { status: 500 });
    }

    // Exclude admins
    const staffProfiles = profiles.filter(
      (p: any) => (p.role || '').toString().toLowerCase() !== 'admin'
    );

    // Date range
    const dayStart = `${dateStr}T00:00:00.000Z`;
    const nextDayObj = new Date(dateStr);
    nextDayObj.setDate(nextDayObj.getDate() + 1);
    const dayEnd = `${nextDayObj.toISOString().slice(0, 10)}T00:00:00.000Z`;

    const { data: rawRecords } = await adminClient
      .from('staff_attendance')
      .select('*')
      .gte('login_at', dayStart)
      .lt('login_at', dayEnd)
      .order('login_at', { ascending: true });

    const records = rawRecords ?? [];

    const result = staffProfiles.map((p: any) => {
      const userRecords = records.filter((r: any) => r.profile_id === p.id);

      if (userRecords.length === 0) {
        return {
          profileId: p.id,
          fullName: p.full_name || p.email || 'Staff Member',
          email: p.email,
          role: p.role || 'staff',
          status: 'absent',
          firstLogin: null,
          firstLogout: null,
          lastLogout: null,
          totalWorkingMinutes: 0,
          totalBreakMinutes: 0,
          sessions: [],
          breaks: [],
        };
      }

      const sessions: any[] = [];
      const breaks: any[] = [];
      let totalWorkingMinutes = 0;
      let totalBreakMinutes = 0;

      userRecords.forEach((r: any, idx: number) => {
        const isActive = !r.logout_at;
        const endIso = r.logout_at || r.last_seen_at || new Date().toISOString();
        const dur = diffMinutes(r.login_at, endIso);

        sessions.push({
          id: r.id,
          loginAt: r.login_at,
          logoutAt: r.logout_at,
          lastSeenAt: r.last_seen_at,
          durationMinutes: dur,
          isActive,
        });

        totalWorkingMinutes += dur;

        if (idx > 0) {
          const prevSession = userRecords[idx - 1];
          const prevEndIso = prevSession.logout_at || prevSession.last_seen_at;
          if (prevEndIso) {
            const breakMins = diffMinutes(prevEndIso, r.login_at);
            if (breakMins > 0) {
              breaks.push({
                startAt: prevEndIso,
                endAt: r.login_at,
                durationMinutes: breakMins,
              });
              totalBreakMinutes += breakMins;
            }
          }
        }
      });

      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];
      const hasActiveSession = sessions.some((s) => s.isActive);

      return {
        profileId: p.id,
        fullName: p.full_name || p.email || 'Staff Member',
        email: p.email,
        role: p.role || 'staff',
        status: hasActiveSession ? 'active' : 'logged_out',
        firstLogin: firstSession ? firstSession.loginAt : null,
        firstLogout: firstSession ? firstSession.logoutAt : null,
        lastLogout: lastSession ? (lastSession.isActive ? null : lastSession.logoutAt) : null,
        totalWorkingMinutes,
        totalBreakMinutes,
        sessions,
        breaks,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('API GET /api/staff-attendance error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    const body = await request.json();
    const { action = 'ping', userId: bodyUserId } = body;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const targetUserId = bodyUserId || currentUser?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Check target user role
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single();

    if ((profile?.role || '').toString().toLowerCase() === 'admin') {
      // Ignore attendance logging for admin users
      return NextResponse.json({ success: true, skipped: true, reason: 'Admin role excluded' });
    }

    const now = new Date().toISOString();

    if (action === 'login') {
      // Close open sessions
      const { data: openSessions } = await adminClient
        .from('staff_attendance')
        .select('id, last_seen_at')
        .eq('profile_id', targetUserId)
        .is('logout_at', null);

      if (openSessions && openSessions.length > 0) {
        for (const s of openSessions) {
          await adminClient
            .from('staff_attendance')
            .update({ logout_at: s.last_seen_at || now })
            .eq('id', s.id);
        }
      }

      // Insert new session
      const { error: insErr } = await adminClient.from('staff_attendance').insert({
        profile_id: targetUserId,
        login_at: now,
        last_seen_at: now,
      });

      if (insErr) {
        console.error('Error inserting staff_attendance:', insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'login', profile_id: targetUserId });
    }

    if (action === 'logout') {
      const { data: openSessions } = await adminClient
        .from('staff_attendance')
        .select('id')
        .eq('profile_id', targetUserId)
        .is('logout_at', null);

      if (openSessions && openSessions.length > 0) {
        for (const s of openSessions) {
          await adminClient
            .from('staff_attendance')
            .update({ logout_at: now, last_seen_at: now })
            .eq('id', s.id);
        }
      }

      return NextResponse.json({ success: true, action: 'logout', profile_id: targetUserId });
    }

    if (action === 'ping') {
      const { data: openSessions } = await adminClient
        .from('staff_attendance')
        .select('id')
        .eq('profile_id', targetUserId)
        .is('logout_at', null)
        .order('login_at', { ascending: false })
        .limit(1);

      if (openSessions && openSessions.length > 0) {
        await adminClient
          .from('staff_attendance')
          .update({ last_seen_at: now })
          .eq('id', openSessions[0].id);
      } else {
        await adminClient.from('staff_attendance').insert({
          profile_id: targetUserId,
          login_at: now,
          last_seen_at: now,
        });
      }

      return NextResponse.json({ success: true, action: 'ping', profile_id: targetUserId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('API POST /api/staff-attendance error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
