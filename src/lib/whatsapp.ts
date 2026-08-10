import twilio from 'twilio';

export type WhatsAppProvider = 'twilio';

export interface SendWhatsAppParams {
  to: string;
  body: string;
  mediaUrl?: string[];
}

export interface BulkWhatsAppRecipient {
  phone: string;
  name?: string;
}

export interface BulkSendResult {
  successful: Array<{ phone: string; id: string }>;
  failed: Array<{ phone: string; error: string }>;
  totalSent: number;
  totalFailed: number;
  provider: string;
}

/**
 * Format and clean phone number to standard international format (e.g. +923001234567)
 */
export function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Handle local Pakistani numbers starting with 03xx
  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1);
  } else if (!cleaned.startsWith('92') && cleaned.length === 10 && cleaned.startsWith('3')) {
    cleaned = '92' + cleaned;
  } else if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    cleaned = cleaned.slice(1);
  }

  return '+' + cleaned;
}

/**
 * Get active provider (Fixed to Twilio)
 */
export function getActiveProvider(): WhatsAppProvider {
  return 'twilio';
}

/**
 * Send a single WhatsApp message using Twilio
 */
export async function sendWhatsAppMessage({ to, body, mediaUrl }: SendWhatsAppParams) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    throw new Error('Twilio credentials missing or invalid in .env.local.');
  }

  try {
    const client = twilio(accountSid, authToken);

    // FORCE FORMATTING: Ensure both numbers start with 'whatsapp:+'
    const formattedTo = `whatsapp:${cleanPhoneNumber(to)}`;
    const formattedFrom = `whatsapp:${cleanPhoneNumber(fromNumber)}`;

    const message = await client.messages.create({
      body,
      from: formattedFrom,
      to: formattedTo,
      ...(mediaUrl && mediaUrl.length > 0 ? { mediaUrl: [mediaUrl[0]] } : {}),
    });

    return { id: message.sid, status: message.status, to: message.to };
  } catch (err: any) {
    const code = err?.code;
    const msg = err?.message || 'Twilio message dispatch failed';
    let hint = '';

    // Specific troubleshooting hints for common Twilio errors
    if (msg.includes('Channel with the specified From address') || code === 63007 || code === 21212) {
      hint = ' -> ACTION REQUIRED: You must activate Twilio WhatsApp Sandbox in your Twilio Console first! 1) Go to https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox 2) Click "Confirm/Activate Sandbox" 3) Send the "join <code-words>" WhatsApp message from your phone to your Sandbox number.';
    } else if (code === 21608 || code === 63015) {
      hint = ' -> ACTION REQUIRED: Recipient has not joined your Twilio Sandbox. Ask them to send the "join <code-words>" code to your Twilio WhatsApp number first.';
    } else if (code === 20003) {
      hint = ' -> ACTION REQUIRED: Invalid Auth Token or Account SID in .env.local.';
    }

    throw new Error(`Twilio Error: ${msg}${hint}`);
  }
}

/**
 * Send bulk WhatsApp messages with 150ms delay between each to avoid rate limits
 */
export async function sendBulkWhatsAppMessages(
  recipients: BulkWhatsAppRecipient[],
  messageTemplate: string,
  mediaUrl?: string[]
): Promise<BulkSendResult> {
  const result: BulkSendResult = {
    successful: [],
    failed: [],
    totalSent: 0,
    totalFailed: 0,
    provider: 'twilio',
  };

  for (const recipient of recipients) {
    try {
      const personalizedBody = messageTemplate.replace(/\{\{name\}\}/gi, recipient.name || 'Member');
      
      const res = await sendWhatsAppMessage({
        to: recipient.phone,
        body: personalizedBody,
        mediaUrl,
      });

      result.successful.push({ phone: recipient.phone, id: res.id });
      result.totalSent++;
    } catch (error: any) {
      console.error(`Failed to send to ${recipient.phone}:`, error.message);
      result.failed.push({
        phone: recipient.phone,
        error: error?.message || 'Failed to dispatch',
      });
      result.totalFailed++;
    }

    // Small delay to prevent hitting Twilio API rate limits too hard
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return result;
}