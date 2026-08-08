import twilio from 'twilio';

export type WhatsAppProvider = 'meta' | 'ultramsg' | 'wassenger' | 'green-api' | 'twilio' | 'local_bridge';

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

  // Handle local Pakistani numbers starting with 03xx (e.g. 03321234567 -> 923321234567)
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
 * Determine the active WhatsApp provider based on environment variables
 */
export function getActiveProvider(): WhatsAppProvider {
  const envProvider = process.env.WHATSAPP_PROVIDER?.toLowerCase() as WhatsAppProvider;
  if (envProvider && ['meta', 'ultramsg', 'wassenger', 'green-api', 'twilio', 'local_bridge'].includes(envProvider)) {
    return envProvider;
  }

  // Auto-detect based on available credentials
  if (process.env.META_PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID !== 'your_meta_phone_number_id') {
    return 'meta';
  }
  if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN && process.env.ULTRAMSG_INSTANCE_ID !== 'instanceXXXXX') {
    return 'ultramsg';
  }
  if (process.env.WASSENGER_API_KEY) {
    return 'wassenger';
  }
  if (process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_TOKEN) {
    return 'green-api';
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    return 'twilio';
  }

  // Default to Meta Official Cloud API for production serverless deployment
  return 'meta';
}



/**
 * Send WhatsApp message using Meta Official Cloud API (Pay-as-you-go, 1000 free msgs/mo)
 */
async function sendViaMetaCloudApi({ to, body, mediaUrl }: SendWhatsAppParams) {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('Meta WhatsApp Cloud API credentials missing. Set META_PHONE_NUMBER_ID and META_ACCESS_TOKEN in .env.local.');
  }

  const recipientDigits = cleanPhoneNumber(to).replace(/[^\d]/g, '');
  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientDigits,
  };

  if (mediaUrl && mediaUrl.length > 0) {
    payload.type = 'image';
    payload.image = { link: mediaUrl[0], caption: body };
  } else {
    payload.type = 'text';
    payload.text = { preview_url: false, body };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || `Meta Cloud API dispatch failed with status ${response.status}`;
    const errorDetails = data.error?.error_data?.details || '';
    const code = data.error?.code;

    let hint = '';
    if (code === 131030 || errorMsg.toLowerCase().includes('allowed list') || errorMsg.toLowerCase().includes('recipient')) {
      hint = ' (Hint: In Meta Test/Sandbox mode, you must add recipient phone numbers to the allowed "To" list in Meta Developer Dashboard under WhatsApp > API Setup > Step 2).';
    } else if (code === 131047 || errorMsg.toLowerCase().includes('24 hour') || errorMsg.toLowerCase().includes('re-engagement')) {
      hint = ' (Hint: Outside 24-hour customer window, recipient must send a message to your WhatsApp number first or use an approved template message).';
    } else if (code === 131037 || errorMsg.toLowerCase().includes('display name')) {
      hint = ' (Hint: Display Name Approval Required. Solution A: Use Meta\'s default Test Phone Number ID from API Setup for instant sending. Solution B: In WhatsApp Manager > Phone Numbers, submit your Display Name e.g. "Iron Lodge Gym" for auto-approval).';
    } else if (code === 190 || errorMsg.toLowerCase().includes('oauth') || errorMsg.toLowerCase().includes('token')) {

      hint = ' (Hint: Your Meta Access Token has expired or is invalid. Please copy a fresh access token from Meta Developer Dashboard).';
    }

    console.error('Meta WhatsApp Cloud API Error:', data.error);
    throw new Error(`Meta API Error: ${errorMsg}${errorDetails ? ` (${errorDetails})` : ''}${hint}`);
  }

  const msgId = data.messages?.[0]?.id || 'meta-ok';
  return { id: msgId, status: 'sent', to: recipientDigits };
}


/**
 * Send WhatsApp message using UltraMsg REST API
 */
async function sendViaUltraMsg({ to, body, mediaUrl }: SendWhatsAppParams) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;

  if (!instanceId || !token) {
    throw new Error(
      'UltraMsg configuration missing. Please add ULTRAMSG_INSTANCE_ID and ULTRAMSG_TOKEN to .env.local.'
    );
  }

  const phone = cleanPhoneNumber(to);
  const endpoint = `https://api.ultramsg.com/${instanceId}/messages/chat`;

  const params = new URLSearchParams();
  params.append('token', token);
  params.append('to', phone);
  params.append('body', body);
  if (mediaUrl && mediaUrl.length > 0) {
    params.append('image', mediaUrl[0]);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok || data.error || (data.sent !== 'true' && data.sent !== true && !data.id)) {
    throw new Error(data.error || data.message || `UltraMsg dispatch failed: ${JSON.stringify(data)}`);
  }

  return { id: String(data.id || data.messageId || 'ok'), status: 'sent', to: phone };
}

/**
 * Send WhatsApp message using Wassenger REST API
 */
async function sendViaWassenger({ to, body, mediaUrl }: SendWhatsAppParams) {
  const apiKey = process.env.WASSENGER_API_KEY;

  if (!apiKey) {
    throw new Error('Wassenger API key missing. Please set WASSENGER_API_KEY in .env.local.');
  }

  const phone = cleanPhoneNumber(to);
  const endpoint = 'https://api.wassenger.com/v1/messages';

  const payload: any = {
    phone: phone,
    message: body,
  };
  if (mediaUrl && mediaUrl.length > 0) {
    payload.media = { url: mediaUrl[0] };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Wassenger dispatch failed with status ${response.status}`);
  }

  return { id: data.id || 'ok', status: 'sent', to: phone };
}

/**
 * Send WhatsApp message using Green API REST API
 */
async function sendViaGreenApi({ to, body, mediaUrl }: SendWhatsAppParams) {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;

  if (!instanceId || !token) {
    throw new Error('Green API credentials missing. Please set GREEN_API_INSTANCE_ID and GREEN_API_TOKEN in .env.local.');
  }

  const digitsOnly = cleanPhoneNumber(to).replace(/[^\d]/g, '');
  const chatId = `${digitsOnly}@c.us`;
  const endpoint = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      message: body,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.idMessage) {
    throw new Error(data.message || `Green API dispatch failed`);
  }

  return { id: data.idMessage, status: 'sent', to: chatId };
}

/**
 * Send WhatsApp message using Local WhatsApp Bridge
 */
async function sendViaLocalBridge({ to, body, mediaUrl }: SendWhatsAppParams) {
  const bridgeUrl = process.env.LOCAL_WHATSAPP_BRIDGE_URL || 'http://localhost:5001/send-whatsapp';
  const phone = cleanPhoneNumber(to);

  try {
    const response = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: body, mediaUrl }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Local WhatsApp Bridge server returned error.');
    }

    return { id: data.id || 'local-ok', status: 'sent', to: phone };
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      throw new Error(
        'Local WhatsApp Bridge server is not running on http://localhost:5001. Please open your terminal and run: node whatsapp_bridge.js'
      );
    }
    throw err;
  }
}


/**
 * Send WhatsApp message using Twilio API (Fallback)
 */
async function sendViaTwilio({ to, body, mediaUrl }: SendWhatsAppParams) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    throw new Error('Twilio credentials missing or invalid in .env.local.');
  }

  const client = twilio(accountSid, authToken);
  let cleanedTo = cleanPhoneNumber(to);
  if (!cleanedTo.startsWith('whatsapp:')) {
    cleanedTo = `whatsapp:${cleanedTo}`;
  }
  let cleanedFrom = fromNumber.trim();
  if (!cleanedFrom.startsWith('whatsapp:')) {
    cleanedFrom = `whatsapp:${cleanedFrom}`;
  }

  const message = await client.messages.create({
    body,
    from: cleanedFrom,
    to: cleanedTo,
    ...(mediaUrl ? { mediaUrl } : {}),
  });

  return { id: message.sid, status: message.status, to: message.to };
}

/**
 * Main Dispatch Function - Auto selects provider
 */
export async function sendWhatsAppMessage(params: SendWhatsAppParams) {
  const provider = getActiveProvider();

  switch (provider) {
    case 'meta':
      return await sendViaMetaCloudApi(params);
    case 'ultramsg':
      return await sendViaUltraMsg(params);
    case 'wassenger':
      return await sendViaWassenger(params);
    case 'green-api':
      return await sendViaGreenApi(params);
    case 'local_bridge':
      return await sendViaLocalBridge(params);
    case 'twilio':
      return await sendViaTwilio(params);
    default:
      return await sendViaLocalBridge(params);
  }
}

/**
 * Send bulk WhatsApp messages with batching, rate-limiting, and template interpolation
 */
export async function sendBulkWhatsAppMessages(
  recipients: BulkWhatsAppRecipient[],
  messageTemplate: string,
  mediaUrl?: string[]
): Promise<BulkSendResult> {
  const provider = getActiveProvider();
  const result: BulkSendResult = {
    successful: [],
    failed: [],
    totalSent: 0,
    totalFailed: 0,
    provider,
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
      console.error(`Failed to send WhatsApp message to ${recipient.phone} via ${provider}:`, error);
      result.failed.push({
        phone: recipient.phone,
        error: error?.message || 'Failed to dispatch message',
      });
      result.totalFailed++;
    }

    // Delay 150ms between messages for smooth rate-limiting
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return result;
}
