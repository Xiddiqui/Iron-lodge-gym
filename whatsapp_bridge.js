/**
 * Iron Lodge Gym — Local WhatsApp Bridge ($0 Cost, 100% Free Bulk Sender)
 * 
 * How to run:
 * 1. Install dependencies: npm install express whatsapp-web.js qrcode-terminal
 * 2. Start the bridge: node whatsapp_bridge.js
 * 3. Scan the QR code printed in terminal ONCE with your phone's WhatsApp (Linked Devices).
 * 4. The bridge listens on http://localhost:5001/send-whatsapp
 */

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;

console.log('--------------------------------------------------');
console.log('  Iron Lodge Gym — Local WhatsApp Bridge          ');
console.log('--------------------------------------------------');
console.log('[Bridge] Initializing WhatsApp Client session...');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.whatsapp_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let isReady = false;

client.on('qr', (qr) => {
  console.log('\n[Bridge] Please scan this QR code with WhatsApp on your phone:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  isReady = true;
  console.log('\n[Bridge] SUCCESS: WhatsApp Client is connected and ready to send messages!\n');
});

client.on('authenticated', () => {
  console.log('[Bridge] WhatsApp session authenticated.');
});

client.on('auth_failure', (msg) => {
  console.error('[Bridge] WhatsApp authentication failed:', msg);
});

client.on('disconnected', (reason) => {
  isReady = false;
  console.log('[Bridge] WhatsApp Client disconnected:', reason);
});

// Health check endpoint
app.get('/status', (req, res) => {
  res.json({ ready: isReady, status: isReady ? 'connected' : 'connecting_or_qr_required' });
});

// Send WhatsApp Message REST endpoint
app.post('/send-whatsapp', async (req, res) => {
  const { phone, message, mediaUrl } = req.body;

  if (!isReady) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp Local Bridge is not ready yet. Please scan the terminal QR code.',
    });
  }

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'Phone number and message text are required.' });
  }

  try {
    let digits = phone.trim().replace(/[^\d]/g, '');
    const chatId = `${digits}@c.us`;

    const response = await client.sendMessage(chatId, message);
    console.log(`[Bridge] Sent WhatsApp message to ${phone} (ID: ${response.id.id})`);

    res.json({ success: true, id: response.id.id, to: phone });
  } catch (err) {
    console.error(`[Bridge] Failed to send message to ${phone}:`, err);
    res.status(500).json({ success: false, error: err.message || 'Failed to dispatch via Local WhatsApp Bridge' });
  }
});

client.initialize();

app.listen(PORT, () => {
  console.log(`[Bridge] HTTP API Server listening on http://localhost:${PORT}`);
});
