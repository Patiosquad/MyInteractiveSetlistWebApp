import { supabase } from '@/lib/supabase';

export type PayoutVerdict = 'ready' | 'no_account' | 'never_verified' | 'previously_verified' | 'check_failed';

export type PayoutAction = 'allow' | 'block' | 'confirm';

export type PayoutReadiness = {
  action: PayoutAction;
  verdict: PayoutVerdict;
  title: string;
  message: string;
};

const NO_ACCOUNT_TITLE = 'Bank Account Required';
const NO_ACCOUNT_MESSAGE =
  'Connect a bank account before going live. Fans can contribute during your show, but without a connected account there is no way to send you the money. Set this up under Payouts on your Profile.';

const NEVER_VERIFIED_TITLE = 'Finish Setting Up Payouts';
const NEVER_VERIFIED_MESSAGE =
  'Your payout account is not finished. Stripe has never confirmed it can accept charges, so fans cannot be charged for their contributions. Open Payouts on your Profile to complete setup, then try again.';

const PREVIOUSLY_VERIFIED_TITLE = 'Payouts Not Working';
const PREVIOUSLY_VERIFIED_MESSAGE =
  'Stripe cannot currently accept charges for your account. Fans can still contribute during your show, but if this is not resolved you may not be paid for this performance. You can continue, or set this up under Payouts on your Profile first.';

// Single source of truth for whether a performer can be paid. Mirrors
// lib/payoutReadiness.ts in the iOS repo; keep the two in step.
//
// THREE TIERS, keyed on two independent facts.
//
// chargesEnabled, read live from Stripe on every call, answers "can this
// performer be charged RIGHT NOW". Never cached in the database, because a
// cached copy of Stripe state goes stale silently.
//
// payoutsVerifiedAt, a timestamp on public.users, answers "has Stripe EVER
// confirmed this performer could be charged". Written only by the
// create-connect-account Edge Function running as service_role, because the
// UPDATE policy on public.users is row-scoped with no column scoping and a
// trust assertion the subject can forge asserts nothing.
//
// The tiers:
//   no account at all            -> BLOCK, nothing to warn about
//   never verified               -> BLOCK, payouts have never worked
//   verified once, broken now    -> CONFIRM, a real performer whose account
//                                   broke gets to decide whether to play
//   working now                  -> ALLOW
//
// The middle distinction matters. detailsSubmitted is NOT a usable proxy for
// "has worked before": fleet2 in the sandbox fleet has detailsSubmitted true
// and has never once had chargesEnabled true, because its address failed at
// submission. Only payoutsVerifiedAt separates a broken veteran from someone
// whose setup never completed.
//
// FAILS OPEN. Every payout failure mode was measured against the Stripe
// sandbox fleet on 2026-08-15 and every one is rejected by Stripe BEFORE a
// card is charged. No fan is ever charged for a performer who cannot receive
// the money. This gate exists to move that failure forward in time, not to
// protect the money path, which Stripe already protects.
//
// Note the status endpoint has two response shapes. When the performer has no
// Connect account it returns five keys and OMITS payoutsVerifiedAt entirely,
// so the client reads undefined rather than null. accountId is therefore
// checked before payoutsVerifiedAt is consulted at all.
export async function checkPayoutReadiness(): Promise<PayoutReadiness> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('[payout-readiness] no session at call time; failing open');
      return { action: 'allow', verdict: 'check_failed', title: '', message: '' };
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

    // Read the body as text and parse it here rather than calling json() on
    // the response directly. json() throws on a non-JSON body, and a gateway
    // or platform error page is HTML, so parsing before checking res.ok sent
    // every infrastructure failure to the catch below carrying a parse
    // message and NO STATUS CODE - which made the diagnostic on this branch
    // unreachable for exactly the failures it was written to explain.
    const bodyText = await res.text();

    let result: any = null;
    try {
      result = JSON.parse(bodyText);
    } catch {
      result = null;
    }

    // Early-exit responses from the Edge Function carry only { error } and no
    // success key at all, so this test covers them as well as an explicit
    // success: false. A null result means the body was not JSON at all.
    if (!res.ok || !result || !result.success) {
      console.error(`[payout-readiness] status check did not complete | ok=${res.ok} | status=${res.status} | parsed=${result !== null} | success=${result?.success} | error=${result?.error ?? 'none'} | body=${bodyText.slice(0, 120)}`);
      return { action: 'allow', verdict: 'check_failed', title: '', message: '' };
    }

    if (result.chargesEnabled === true) {
      return { action: 'allow', verdict: 'ready', title: '', message: '' };
    }

    if (!result.accountId) {
      return { action: 'block', verdict: 'no_account', title: NO_ACCOUNT_TITLE, message: NO_ACCOUNT_MESSAGE };
    }

    if (!result.payoutsVerifiedAt) {
      return { action: 'block', verdict: 'never_verified', title: NEVER_VERIFIED_TITLE, message: NEVER_VERIFIED_MESSAGE };
    }

    return { action: 'confirm', verdict: 'previously_verified', title: PREVIOUSLY_VERIFIED_TITLE, message: PREVIOUSLY_VERIFIED_MESSAGE };
  } catch (err: any) {
    console.error(`[payout-readiness] threw | message=${err?.message ?? 'unknown'}`);
    return { action: 'allow', verdict: 'check_failed', title: '', message: '' };
  }
}
