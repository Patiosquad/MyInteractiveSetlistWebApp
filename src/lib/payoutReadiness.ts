import { supabase } from '@/lib/supabase';

export type PayoutVerdict = 'ready' | 'no_account' | 'restricted' | 'check_failed';

export type PayoutReadiness = {
  allowed: boolean;
  verdict: PayoutVerdict;
  message: string;
};

const NO_ACCOUNT_MESSAGE =
  'Connect a bank account before going live. Fans can contribute during your show, but without a connected account there is no way to send you the money. Set this up under Payouts on your Profile.';

const RESTRICTED_MESSAGE =
  'Your payout account needs attention before you can go live. Stripe has restricted it, so fans cannot be charged for their contributions. Open Payouts on your Profile to resolve it, then try again.';

// Single source of truth for whether a performer can be paid.
//
// Fetches its own session at call time rather than closing over component
// state -- callers may invoke this from a mount effect where state is not
// yet populated.
//
// FAILS OPEN. Every payout failure mode was measured against the Stripe
// sandbox fleet on 2026-08-15 and every one of them is rejected by Stripe
// BEFORE a card is charged: a null destination fails with parameter_missing
// on application_fee_amount, an inactive transfers capability fails with
// insufficient_capabilities_for_transfer, and an inactive card_payments
// capability fails at confirm. No fan is ever charged for a performer who
// cannot receive the money. This gate therefore exists to move that failure
// forward in time -- telling the performer at Go Live instead of hours after
// the show -- not to protect the money path, which Stripe already protects.
// Blocking a real performance because a status call flaked is the worse
// outcome, so a failed check allows the transition.
//
// The verdict keys off chargesEnabled, which predicted the correct outcome
// on all seven accounts measured. accountId separates "never connected"
// from "connected but restricted" so the two get different copy.
export async function checkPayoutReadiness(): Promise<PayoutReadiness> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('[payout-readiness] no session at call time; failing open');
      return { allowed: true, verdict: 'check_failed', message: '' };
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: session.user.id, mode: 'status' }),
      }
    );

    const result = await res.json();

    // Early-exit responses from the Edge Function carry only { error } and no
    // success key at all, so this test covers them as well as an explicit
    // success: false.
    if (!res.ok || !result.success) {
      console.error(`[payout-readiness] status check did not complete | ok=${res.ok} | status=${res.status} | success=${result?.success} | error=${result?.error ?? 'none'}`);
      return { allowed: true, verdict: 'check_failed', message: '' };
    }

    if (!result.accountId) {
      return { allowed: false, verdict: 'no_account', message: NO_ACCOUNT_MESSAGE };
    }

    if (result.chargesEnabled !== true) {
      return { allowed: false, verdict: 'restricted', message: RESTRICTED_MESSAGE };
    }

    return { allowed: true, verdict: 'ready', message: '' };
  } catch (err: any) {
    console.error(`[payout-readiness] threw | message=${err?.message ?? 'unknown'}`);
    return { allowed: true, verdict: 'check_failed', message: '' };
  }
}
