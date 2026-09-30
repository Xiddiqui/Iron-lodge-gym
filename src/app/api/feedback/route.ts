import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (key && key !== 'your_service_role_key') {
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { member_number, name, phone, email, message } = body;

    const cleanMemberNum = (member_number || '').toString().trim();
    const cleanName = (name || '').toString().trim();
    const cleanMessage = (message || '').toString().trim();

    if (!cleanMemberNum) {
      return NextResponse.json(
        { error: 'Member Number / ID is required. Only registered members can submit feedback.' },
        { status: 400 }
      );
    }

    if (!cleanName || !cleanMessage) {
      return NextResponse.json(
        { error: 'Please fill in your name and message.' },
        { status: 400 }
      );
    }

    // Initialize clients
    const adminClient = getAdminClient();
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const dbClient = adminClient || anonClient;

    let matchedMember: { id: string; member_number: string } | null = null;

    // 1. Try RPC function verify_member_exists
    try {
      const { data: rpcData, error: rpcError } = await dbClient.rpc('verify_member_exists', {
        p_member_number: cleanMemberNum,
      });

      if (!rpcError && rpcData && rpcData.length > 0 && rpcData[0].exists) {
        matchedMember = {
          id: rpcData[0].member_id,
          member_number: rpcData[0].member_number || cleanMemberNum,
        };
      }
    } catch (e) {
      console.warn('[Feedback API] RPC call failed, falling back to direct query', e);
    }

    // 2. Direct query fallback if RPC didn't match or failed
    if (!matchedMember && adminClient) {
      const { data: directExact } = await adminClient
        .from('members')
        .select('id, member_number')
        .eq('member_number', cleanMemberNum)
        .maybeSingle();

      if (directExact) {
        matchedMember = directExact;
      } else {
        const { data: allMembers } = await adminClient
          .from('members')
          .select('id, member_number');

        if (allMembers && allMembers.length > 0) {
          const found = allMembers.find((m: any) => {
            if (m.id === cleanMemberNum) return true;
            if (m.member_number && cleanMemberNum) {
              if (m.member_number.trim() === cleanMemberNum) return true;
              if (
                /^\d+$/.test(m.member_number.trim()) &&
                /^\d+$/.test(cleanMemberNum) &&
                Number(m.member_number) === Number(cleanMemberNum)
              ) {
                return true;
              }
            }
            return false;
          });

          if (found) {
            matchedMember = found;
          }
        }
      }
    }

    if (!matchedMember) {
      return NextResponse.json(
        { error: `No active member found with Member Number / ID "${cleanMemberNum}". Only registered members can submit suggestions.` },
        { status: 400 }
      );
    }

    // 3. Insert enquiry into database
    const payload = {
      name: cleanName,
      phone: phone ? (phone as string).trim() : null,
      email: email ? (email as string).trim() : null,
      message: cleanMessage,
      status: 'new',
      member_number: matchedMember.member_number || cleanMemberNum,
      member_id: matchedMember.id || null,
    };

    const { error: insertError } = await dbClient
      .from('enquiries')
      .insert(payload);

    if (insertError) {
      console.error('[Feedback API] Insert error:', insertError);
      // Fallback if migration 020 isn't applied yet on database (columns don't exist)
      if (insertError.code === '42703' || insertError.message?.includes('column')) {
        const fallbackPayload = {
          name: cleanName,
          phone: phone ? (phone as string).trim() : null,
          email: email ? (email as string).trim() : null,
          message: cleanMessage,
          status: 'new',
        };
        const { error: retryErr } = await dbClient.from('enquiries').insert(fallbackPayload);
        if (retryErr) throw retryErr;
      } else {
        throw insertError;
      }
    }

    return NextResponse.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (err: any) {
    console.error('[Feedback API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit feedback. Please try again.' },
      { status: 500 }
    );
  }
}
