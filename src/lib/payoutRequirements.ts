// HAND-SYNCED COPY. The iOS twin is MyApp/lib/payoutRequirements.ts.
// There is no shared package between the repos, so these two files are kept in
// step by hand, exactly as src/lib/payoutReadiness.ts is. If you change one,
// change the other in the same session.

export type PayoutSetupState =
  | 'no_account'
  | 'active'
  | 'action_required'
  | 'under_review'
  | 'other_blocked'
  | 'unknown';

export type PayoutSetupDetail = {
  state: PayoutSetupState;
  heading: string;
  body: string;
  items: string[];
};

// Raw Stripe requirement identifiers mapped to something a performer can act on.
// Built ONLY from identifiers observed on the sandbox fleet on 2026-08-17 - not
// from documentation and not from memory. Anything unmapped is deliberately
// dropped and surfaces as a count instead of a raw identifier, because
// "individual.verification.additional_document" is worse than "3 more items".
//
// Several Stripe fields collapse to one human concept: four address fields are
// one address, three date-of-birth fields are one birthday. The values below
// are deduplicated by the caller, so a group of four yields one label.
const REQUIREMENT_LABELS: Record<string, string> = {
  'individual.first_name': 'Your legal name',
  'individual.last_name': 'Your legal name',
  'individual.dob.day': 'Your date of birth',
  'individual.dob.month': 'Your date of birth',
  'individual.dob.year': 'Your date of birth',
  'individual.address.city': 'Your home address',
  'individual.address.line1': 'Your home address',
  'individual.address.line2': 'Your home address',
  'individual.address.postal_code': 'Your home address',
  'individual.address.state': 'Your home address',
  'individual.phone': 'Your phone number',
  'individual.email': 'Your email address',
  'individual.ssn_last_4': 'The last 4 digits of your Social Security number',
  'individual.id_number': 'Your full Social Security number',
  'individual.verification.document': 'A photo of your ID',
  'external_account': 'Your bank account',
  'business_profile.mcc': 'The type of performing you do',
  'business_profile.url': 'A website or social media link',
  'business_profile.product_description': 'A description of what you do',
  'settings.payments.statement_descriptor': 'The name fans see on their card statement',
  'tos_acceptance.date': 'Accepting the Stripe terms',
  'tos_acceptance.ip': 'Accepting the Stripe terms',
};

// The one state resolvePayoutSetup cannot return, because it describes a
// failure to obtain a status response at all rather than anything the response
// said. Exported as a constant so both the no-session and the request-failed
// paths set an identical object, and so this copy sits alongside the other five
// states rather than being inlined at each call site.
//
// Deliberately NOT a blocking message. A failed status check says nothing about
// the performer's actual Stripe state, so it must not imply their setup is
// broken - it only reports that we could not look.
export const UNKNOWN_PAYOUT_SETUP: PayoutSetupDetail = {
  state: 'unknown',
  heading: 'Payout Status Unavailable',
  body: 'We could not check your payout status right now. This does not change any setup you have already completed.',
  items: [],
};

// Above this many distinct labels, the list stops being useful and becomes a
// wall of text. An abandoned onboarding returns 17 raw identifiers, which is
// 9 labels after grouping - that is not a payouts card, it is a form. Those
// performers get a single sentence instead.
const MAX_LISTED_ITEMS = 4;

export function labelsFor(identifiers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of identifiers) {
    const label = REQUIREMENT_LABELS[id];
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

// Resolves the full payouts picture from one status response.
//
// ORDER IS LOAD-BEARING. errors is checked before currently_due because Stripe
// writes a far better message than any mapping table when it has one: a failed
// address returns "Address couldn't be verified. Combination of city, region,
// and postal code doesn't seem to be valid..." naming the performer's own
// submitted values. But errors is EMPTY when a value was merely re-requested
// rather than rejected - a failed SSN verification returns no error at all and
// simply re-lists individual.id_number. Both paths are required.
//
// currently_due is the trigger, NOT past_due. past_due is a SUBSET of
// currently_due meaning "already overdue" - on the fleet, one account had 3
// past_due inside 4 currently_due. Keying off past_due would silently drop
// requirements.
//
// eventually_due is deliberately ignored. It lists things that are not required
// yet, and naming them on a screen about what is blocking payouts today is
// noise.
export function resolvePayoutSetup(result: any): PayoutSetupDetail {
  if (!result || !result.accountId) {
    return {
      state: 'no_account',
      heading: 'Bank Account Not Connected',
      body: 'Connect a bank account to receive payouts from fan song requests.',
      items: [],
    };
  }

  if (result.chargesEnabled === true) {
    return {
      state: 'active',
      heading: 'Payouts Active',
      body: 'Your bank account is connected and ready to receive payouts from fan song requests.',
      items: [],
    };
  }

  const errors = Array.isArray(result.errors) ? result.errors : [];
  const errorReasons: string[] = [];
  const seenReasons = new Set<string>();
  for (const e of errors) {
    const reason = e?.reason;
    if (typeof reason !== 'string' || !reason) continue;
    if (seenReasons.has(reason)) continue;
    seenReasons.add(reason);
    errorReasons.push(reason);
  }

  if (errorReasons.length > 0) {
    return {
      state: 'action_required',
      heading: 'Something Needs Fixing',
      body: 'Stripe could not verify some of what you submitted. Continue setup to correct it.',
      items: errorReasons.slice(0, MAX_LISTED_ITEMS),
    };
  }

  const currentlyDue = Array.isArray(result.currentlyDue) ? result.currentlyDue : [];
  if (currentlyDue.length > 0) {
    const labels = labelsFor(currentlyDue);
    if (labels.length > 0 && labels.length <= MAX_LISTED_ITEMS) {
      return {
        state: 'action_required',
        heading: 'Setup Not Finished',
        body: 'Stripe still needs the following before you can receive payouts:',
        items: labels,
      };
    }
    return {
      state: 'action_required',
      heading: 'Setup Not Finished',
      body: 'Stripe still needs several things from you before you can receive payouts. Continue setup to finish.',
      items: [],
    };
  }

  const pending = Array.isArray(result.pendingVerification) ? result.pendingVerification : [];
  if (pending.length > 0) {
    return {
      state: 'under_review',
      heading: 'Stripe Is Reviewing',
      body: 'You have submitted everything Stripe asked for and it is being reviewed. Nothing is needed from you right now. This usually finishes within a day or two.',
      items: [],
    };
  }

  // Catch-all rather than a branch keyed on specific disabled_reason strings.
  // No sandbox account produces a rejected reason, so a branch built on guessed
  // string values could not be tested. This also absorbs any disabled_reason
  // Stripe adds later.
  return {
    state: 'other_blocked',
    heading: 'Payouts Not Available',
    body: 'Stripe cannot currently accept charges for your account, and it is not something you can resolve from here. Open your payout account settings for details.',
    items: [],
  };
}
