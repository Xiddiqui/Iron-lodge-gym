import { supabase } from '@/lib/supabase/client';

export interface StaffSession {
  id: string;
  loginAt: string;
  logoutAt: string | null;
  lastSeenAt: string;
  durationMinutes: number;
  isActive: boolean;
}

export interface StaffBreak {
  startAt: string;
  endAt: string;
  durationMinutes: number;
}

export interface StaffDayAttendance {
  profileId: string;
  fullName: string;
  email: string | null;
  role: string;
  status: 'active' | 'logged_out' | 'absent';
  firstLogin: string | null;
  firstLogout: string | null;
  lastLogout: string | null;
  totalWorkingMinutes: number;
  totalBreakMinutes: number;
  sessions: StaffSession[];
  breaks: StaffBreak[];
}

/**
 * Record a new login session when a user logs in.
 */
export async function recordStaffLogin(profileId: string) {
  if (!profileId) return;
  const now = new Date().toISOString();
  try {
    // Close any previous unclosed sessions for this user
    const { data: openSessions } = await supabase
      .from('staff_attendance')
      .select('id, last_seen_at')
      .eq('profile_id', profileId)
      .is('logout_at', null);

    if (openSessions && openSessions.length > 0) {
      for (const s of openSessions) {
        await supabase
          .from('staff_attendance')
          .update({ logout_at: s.last_seen_at || now })
          .eq('id', s.id);
      }
    }

    // Insert new login session
    const { error } = await supabase.from('staff_attendance').insert({
      profile_id: profileId,
      login_at: now,
      last_seen_at: now,
    });

    if (error) {
      console.error('staff_attendance insert error:', error.message);
    }
  } catch (err) {
    console.error('Error in recordStaffLogin:', err);
  }
}

/**
 * Record a logout event when the user signs out.
 */
export async function recordStaffLogout(profileId: string) {
  if (!profileId) return;
  const now = new Date().toISOString();
  try {
    const { data: openSessions } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('profile_id', profileId)
      .is('logout_at', null);

    if (openSessions && openSessions.length > 0) {
      for (const s of openSessions) {
        await supabase
          .from('staff_attendance')
          .update({ logout_at: now, last_seen_at: now })
          .eq('id', s.id);
      }
    }
  } catch (err) {
    console.error('Error in recordStaffLogout:', err);
  }
}

/**
 * Ping function to maintain active session activity (updates last_seen_at)
 */
export async function pingStaffSession(profileId: string) {
  if (!profileId) return;
  const now = new Date().toISOString();

  try {
    const { data: openSessions } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('profile_id', profileId)
      .is('logout_at', null)
      .order('login_at', { ascending: false })
      .limit(1);

    if (openSessions && openSessions.length > 0) {
      await supabase
        .from('staff_attendance')
        .update({ last_seen_at: now })
        .eq('id', openSessions[0].id);
    } else {
      await supabase.from('staff_attendance').insert({
        profile_id: profileId,
        login_at: now,
        last_seen_at: now,
      });
    }
  } catch (err) {
    console.error('Error in pingStaffSession:', err);
  }
}

/**
 * Calculate minutes difference between two ISO date strings
 */
function diffMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Format minutes into readable "Xh Ym" format
 */
export function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours === 0) return `${remainingMins}m`;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Fetch staff attendance for a given date and compute sessions, breaks, and summary
 */
export async function fetchStaffAttendanceForDate(dateStr: string): Promise<StaffDayAttendance[]> {
  // Fetch profiles
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .order('full_name');

  if (pError) {
    console.error('Error fetching profiles for staff attendance:', pError);
    throw pError;
  }

  if (!profiles || profiles.length === 0) return [];

  // Filter: include all profiles with role === 'staff' OR non-admin profiles.
  // If all profiles have role = 'staff', show them. If none match, show all profiles.
  const staffProfiles = profiles.filter((p: any) => (p.role || '').toLowerCase() === 'staff');
  const nonAdminProfiles = profiles.filter((p: any) => (p.role || '').toLowerCase() !== 'admin');
  const targetProfiles = staffProfiles.length > 0 ? staffProfiles : (nonAdminProfiles.length > 0 ? nonAdminProfiles : profiles);

  // Date range
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const nextDayObj = new Date(dateStr);
  nextDayObj.setDate(nextDayObj.getDate() + 1);
  const dayEnd = `${nextDayObj.toISOString().slice(0, 10)}T00:00:00.000Z`;

  const { data: rawRecords, error: rError } = await supabase
    .from('staff_attendance')
    .select('*')
    .gte('login_at', dayStart)
    .lt('login_at', dayEnd)
    .order('login_at', { ascending: true });

  if (rError) {
    console.error('Error querying staff_attendance:', rError.message);
    if (rError.code === '42P01' || rError.message?.includes('does not exist')) {
      throw new Error('Database Table Missing: Please run migration 011 in Supabase SQL editor to create staff_attendance table.');
    }
  }

  const records = rawRecords ?? [];

  return targetProfiles.map((p: any) => {
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

    const sessions: StaffSession[] = [];
    const breaks: StaffBreak[] = [];
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
}
