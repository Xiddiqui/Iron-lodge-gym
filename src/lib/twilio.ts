import {
  sendWhatsAppMessage as sendWhatsAppMsg,
  sendBulkWhatsAppMessages as sendBulkWhatsAppMsgs,
  cleanPhoneNumber,
  SendWhatsAppParams,
  BulkWhatsAppRecipient,
} from './whatsapp';
import twilio from 'twilio';

export { cleanPhoneNumber as formatWhatsAppNumber };
export type { SendWhatsAppParams, BulkWhatsAppRecipient };

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    throw new Error(
      'Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are missing or invalid. TWILIO_ACCOUNT_SID must start with "AC".'
    );
  }
  return twilio(accountSid, authToken);
}

export async function sendWhatsAppMessage(params: SendWhatsAppParams) {
  const res = await sendWhatsAppMsg(params);
  return {
    sid: res.id,
    status: res.status,
    to: res.to,
  };
}

export async function sendBulkWhatsAppMessages(
  recipients: BulkWhatsAppRecipient[],
  messageTemplate: string,
  mediaUrl?: string[]
) {
  const res = await sendBulkWhatsAppMsgs(recipients, messageTemplate, mediaUrl);
  return {
    successful: res.successful.map((s) => ({ phone: s.phone, sid: s.id })),
    failed: res.failed,
    totalSent: res.totalSent,
    totalFailed: res.totalFailed,
    provider: res.provider,
  };
}

