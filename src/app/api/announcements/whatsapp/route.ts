import { NextRequest, NextResponse } from 'next/server';
import { sendBulkWhatsAppMessages } from '@/lib/twilio';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, recipients, target, mediaUrl } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message body is required and must be a string' },
        { status: 400 }
      );
    }

    let finalRecipients: Array<{ phone: string; name?: string }> = recipients || [];

    // If target is "all_members" or recipients list is empty, fetch phone numbers from Supabase
    if (target === 'all_members' || (!recipients || recipients.length === 0)) {
      const supabase = await createServerSupabaseClient();
      const { data: members, error } = await supabase
        .from('members')
        .select('full_name, phone_number')
        .not('phone_number', 'is', null);

      if (error) {
        console.error('Error fetching members for WhatsApp announcement:', error);
        return NextResponse.json(
          { error: 'Failed to fetch member phone numbers from database' },
          { status: 500 }
        );
      }

      if (members && members.length > 0) {
        finalRecipients = members
          .filter((m) => Boolean(m.phone_number))
          .map((m) => ({
            phone: m.phone_number,
            name: m.full_name,
          }));
      }
    }

    if (finalRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipient phone numbers found' },
        { status: 400 }
      );
    }

    // Trigger bulk WhatsApp dispatch
    const result = await sendBulkWhatsAppMessages(finalRecipients, message, mediaUrl);

    return NextResponse.json({
      success: true,
      message: `Dispatched WhatsApp announcement to ${result.totalSent} recipients`,
      details: result,
    });
  } catch (err: any) {
    console.error('Error in WhatsApp announcement route:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
