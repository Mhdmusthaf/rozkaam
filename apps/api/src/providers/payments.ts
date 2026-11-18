// Payment provider for a business funding a requirement.
// Sandbox: the payment always succeeds and no real money moves.
// Razorpay (orders + signature check) implements the same function later.
import { randomUUID } from 'node:crypto';

export interface PaymentResult {
  ok: boolean;
  provider: 'sandbox' | 'razorpay';
  reference: string;
}

export async function collectFunding(_amountPaise: number, _businessId: string): Promise<PaymentResult> {
  return { ok: true, provider: 'sandbox', reference: `SBX-${randomUUID().slice(0, 8).toUpperCase()}` };
}
