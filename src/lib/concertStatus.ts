// The five values of concerts.status, as enforced by the concerts_status_check
// constraint. Exported so the performer screens stop each declaring their own
// copy and disagreeing: before this, dashboard/page.tsx and concerts/[id]/page.tsx
// each had their own five-literal union and concerts/[id]/live/page.tsx typed
// status as bare string with no union at all.
//
// NOTE the check constraint also admits 'taking_requests', which no code path
// writes and which is not included here. If a row ever carries it, the cast at
// each query boundary will not catch it - Supabase returns any, so none of
// these types validate incoming rows. This union documents intent; it does not
// enforce anything at runtime.
export type ConcertStatus = 'new' | 'preview' | 'live' | 'closing' | 'closed';
