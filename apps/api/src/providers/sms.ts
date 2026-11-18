// SMS provider. Each outside service sits behind a small function like this,
// so a live provider can replace the sandbox without touching the rest.
import { randomInt } from 'node:crypto';

import { env } from '../env';

/** Sends a login code to the phone and returns the code that was sent. */
export async function sendOtp(phone: string): Promise<string> {
  if (env.SMS_PROVIDER === 'sandbox') {
    // Sandbox: nothing is sent; the fixed code from the environment is accepted.
    return env.SANDBOX_OTP;
  }
  // Live provider (MSG91) goes here. It must send `code` to `phone`.
  const code = String(randomInt(100000, 1000000));
  throw new Error(`No live SMS provider is configured (wanted to send to ${phone.slice(0, 2)}xxxxxxxx, code length ${code.length}).`);
}
