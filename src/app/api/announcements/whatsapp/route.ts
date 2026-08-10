import { NextRequest, NextResponse } from 'next/server';
import { sendBulkWhatsAppMessages, getActiveProvider } from '@/lib/whatsapp';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET: Check if Twilio is configured
 */
export async function GET() {
  const provider = getActiveProvider();
  const isConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_WHATSAPP_NUMBER
  );

  return NextResponse.json({
    provider,
    configured: isConfigured,
  });
}

/**
 * POST: Send individual or bulk WhatsApp messages via Twilio
 */
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

    // Trigger bulk WhatsApp dispatch using the Twilio-only library
    const result = await sendBulkWhatsAppMessages(finalRecipients, message, mediaUrl);

    // If everything failed, provide the specific Twilio error from the first failed attempt
    if (result.totalSent === 0 && result.totalFailed > 0) {
      const firstError = result.failed[0]?.error || 'Failed to send WhatsApp messages.';
      return NextResponse.json(
        {
          error: `${firstError} (Provider: Twilio)`,
          details: result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Dispatched WhatsApp announcement to ${result.totalSent} recipients via Twilio`,
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