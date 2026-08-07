import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'; // Sandbox fallback

let client: twilio.Twilio | null = null;

export function getTwilioClient() {
  if (!client) {
    if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
      throw new Error(
        'Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are missing or invalid. TWILIO_ACCOUNT_SID must start with "AC".'
      );
    }
    client = twilio(accountSid, authToken);
  }
  return client;
}

export interface SendWhatsAppParams {
  to: string; // e.g. "+923001234567" or "whatsapp:+923001234567"
  body: string;
  mediaUrl?: string[];
}

/**
 * Format a phone number to Twilio's WhatsApp format (whatsapp:+E164)
 */
export function formatWhatsAppNumber(phone: string): string {
  let cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  if (!cleaned.startsWith('whatsapp:')) {
    return `whatsapp:${cleaned}`;
  }
  return cleaned;
}

/**
 * Send a single WhatsApp message using Twilio
 */
export async function sendWhatsAppMessage({ to, body, mediaUrl }: SendWhatsAppParams) {
  const twilioClient = getTwilioClient();
  const formattedTo = formatWhatsAppNumber(to);
  const formattedFrom = formatWhatsAppNumber(fromWhatsAppNumber);

  const response = await twilioClient.messages.create({
    body,
    from: formattedFrom,
    to: formattedTo,
    ...(mediaUrl ? { mediaUrl } : {}),
  });

  return {
    sid: response.sid,
    status: response.status,
    to: response.to,
  };
}

export interface BulkWhatsAppRecipient {
  phone: string;
  name?: string;
}

export interface BulkSendResult {
  successful: Array<{ phone: string; sid: string }>;
  failed: Array<{ phone: string; error: string }>;
  totalSent: number;
  totalFailed: number;
}

/**
 * Send bulk WhatsApp messages with batching and rate limiting delay
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
  };

  const twilioClient = getTwilioClient();
  const formattedFrom = formatWhatsAppNumber(fromWhatsAppNumber);

  // Send sequentially or in small controlled batches to avoid hitting Twilio rate limits
  for (const recipient of recipients) {
    try {
      // Interpolate recipient variables like {{name}} if present in template
      const personalizedBody = messageTemplate.replace(/\{\{name\}\}/gi, recipient.name || 'Member');
      const formattedTo = formatWhatsAppNumber(recipient.phone);

      const message = await twilioClient.messages.create({
        body: personalizedBody,
        from: formattedFrom,
        to: formattedTo,
        ...(mediaUrl ? { mediaUrl } : {}),
      });

      result.successful.push({ phone: recipient.phone, sid: message.sid });
      result.totalSent++;
    } catch (error: any) {
      console.error(`Failed to send WhatsApp to ${recipient.phone}:`, error);
      result.failed.push({
        phone: recipient.phone,
        error: error?.message || 'Failed to dispatch message',
      });
      result.totalFailed++;
    }

    // Small delay (100ms) between messages to stay smooth under Twilio API limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return result;
}
