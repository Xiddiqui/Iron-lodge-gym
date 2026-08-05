/**
 * /api/iclock/getrequest — ZKTeco K50 iClock Command Poll Handler
 *
 * The K50 periodically calls GET /iclock/getrequest?SN=<serial>
 * to fetch any pending server-side commands (e.g. set time, enroll user).
 *
 * We respond with "OK" (no pending commands) to keep the device happy.
 * In the future, this endpoint can be extended to push commands to the device.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN') || 'UNKNOWN';

  // Optional: log device heartbeat for uptime monitoring
  console.log(`[Biometric] Command poll from device SN=${sn} — no commands pending`);

  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
