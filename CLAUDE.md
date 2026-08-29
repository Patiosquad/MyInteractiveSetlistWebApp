@AGENTS.md

# SetTuner — Web Repo (setlistweb) — Claude Code Operating Rules

These rules are binding on every session. Read them before touching any file.
The @AGENTS.md import above carries a live warning: this Next.js version has
breaking changes vs. training data. Read `node_modules/next/dist/docs/` before
writing any code that touches routing, data fetching, or config. Heed
deprecation notices.

---

## Working Agreement

- One step at a time. No chaining. Chap verifies each output before the next step.
- Read before write, always. Every build step is preceded by a read-only investigation with exact-text anchor confirmation.
- If an anchor is not found verbatim, STOP and report. Do not attempt a fuzzy match or substitute.
- Surface scope discrepancies explicitly. If investigation reveals a larger or smaller scope than stated, report the discrepancy and wait for a decision. Never silently expand or silently limit.
- Chap runs all git, SQL, and browser verification himself in PowerShell and the browser, and pastes literal output. Claude Code does not execute git.
- Verification is non-negotiable. Literal terminal output, SQL results, or browser behavior are the only acceptable proof. Never describe what code "should" do as a substitute.

---

## Formatting Rules

- Every prompt and SQL statement goes in a fenced code block so Chap can copy it without dragging to highlight.
- Prefix every Claude Code prompt with: [web — setlistweb]
- Every prompt includes exact-text anchors and an explicit stop-and-report instruction on mismatch.
- Never present planned or illustrative code in the same format as a runnable command.
- Instructions must be step-by-step with expected output stated so Chap can verify before proceeding.

---

## TypeScript Baseline

- **Baseline is ZERO for `src/`.** Any `error TS` line naming a file under `src/` is a regression.
- **Two errors in `.next/` are expected** as of 2026-08-29: `.next/types/validator.ts` references `src/app/api/places/autocomplete/route.js` and `.../details/route.js`, both deleted in 23c87bd when the web moved to `places-proxy`. These are generated build artifacts, not source. Deleting `.next` and rebuilding clears them; do not do that mid-task to make a number look right.
- There is no `typecheck` script in `package.json`. Run it directly:
```powershell
  npx tsc --noEmit -p tsconfig.json
```
- Expected: exit code 0, no output. Any output at all is a failure — investigate before proceeding.

---

## Commit Protocol

- Claude Code does NOT run git. Chap runs all git commands in PowerShell.
- Browser verification of the relevant performer flow is required before any commit — hard-refresh (Ctrl+Shift+R) before testing, to rule out stale cached JS.
- When Claude provides a commit block, it must include `git push` immediately after `git commit` in the same block — never as a separate follow-up.
- Web commits before iOS when both repos are touched in the same session.
- **A push to main is a production deploy.** Vercel auto-deploys on push — there is no staging gate. Treat `git push` on this repo as equivalent to shipping.

---

## Line Endings — Do Not "Fix" This

**Line endings are MIXED in this repo and must be measured per file, never assumed.** Measured 2026-08-29: `src/app/dashboard/page.tsx` is CRLF, `src/app/concerts/[id]/page.tsx` is CRLF, `src/app/concerts/[id]/live/page.tsx` is LF, `tokens/tokens.css` is LF. A previous version of this file claimed the repo was LF-only. It is not.

Probe every file by raw byte count immediately before editing it — count `\r\n` and bare `\n` separately. If both are non-zero the file is genuinely mixed: STOP and report rather than guessing. Convert the newlines in every anchor and replacement to match what was measured, and preserve the trailing-newline state exactly as found — some files here end with a newline and some do not.

**Do NOT make the TOTAL line count a precondition.** State only what actually protects against a whole-file diff: CRLF is zero or bare LF is zero, bare CR is zero, and whether the file ends with a newline. A total line count is a checksum of the PREVIOUS step and goes stale the moment any edit lands — it aborts safely but costs a round trip every time, and it cost two in one session on 2026-08-29. The anchor verification is what guards correctness, and it has never been the thing that failed. Report the totals before and after; do not gate on them.

`core.autocrlf = true` and there is no `.gitattributes`, so git warns `LF will be replaced by CRLF` on LF files. **That warning is cosmetic. Do not attempt to resolve it mid-task.** It also means a file's endings can change on the next checkout — which is why they are measured per session, not carried forward.

---

## Vocabulary Discipline

These words are banned from all UI strings, log messages, and code comments:

| Banned | Use instead |
|--------|-------------|
| purchase | contribute |
| tip | contribute |
| refund | (describe the action explicitly) |
| crowdfunding | (never use) |

"Charged" and "contribute" are the only money-action words.

---

## Architecture Invariants

- **This repo is performer-facing only.** There is no fan-facing web experience anywhere in this codebase. Never create a fan-facing route or page.
- **Fans are iOS-only by design.** Do not reference fan flows here.
- **There is no `supabase/functions/` directory in this repo.** Edge Functions live only in the iOS repo (`MyApp`). Never create or reference Edge Functions here.
- **Concert lifecycle:** `new → preview → live → closing → closed`. The value `building` is retired — never use it.
- **Dollar amounts:** always `Math.round()`, never `.toFixed(2)`.
- **Contribution limits:** $1 min, $99 max per contribution; $999 per-fan-per-song-per-concert ceiling, enforced server-side.
- **Platform fee:** 15% on accepted contributions.
- **Payment model:** deferred capture, concert-level pooling.
- **`total_amount` (not `amount`)** is the canonical contributions field for leaderboard and tracker displays.
- **Hosting:** Vercel, auto-deploy on push to main.

---

## Error Handling Conventions

- Log format: backtick template literals interpolating fields, prefixed with screen tag and function name.
  - Example: `` `[web-profile] checkAccountStatus: ok=${result.ok} status=${result.status}` ``
- `PostgrestError` carries: `message`, `code`, `details`, `hint`.
- `AuthError` from `supabase.auth.*` carries: `message`, `status` ONLY — do not add `code`, `details`, or `hint`.
- `fetch Response` carries: `status`, `statusText` — read `res.ok` before any inline ternary.
- **ALERT vs LOG-ONLY rule:**
  - Surface errors to the performer only on explicit user-initiated actions that failed.
  - Log only (never block) for background calls during page load or triggered by the app rather than the user.
- **This repo historically does NOT check `error` on reads** — only writes
  destructure it, and reads branch on `data` truthiness. That convention has
  a known defect (a failed read is indistinguishable from an empty result)
  and is being corrected file by file. New reads SHOULD destructure and log
  `error`. Do not match the old convention just because it is prevalent.

---

## Forced-Failure Verification

**For Supabase writes (UPDATE/DELETE/SELECT):**
Append `.eq('zzz_forced_failure_test', 'x')` — PostgREST rejects at query planning (error 42703), touching zero rows.

**CRITICAL: This does NOT work on INSERT.** A filter on an insert is ignored and the row is written. Use a nonexistent-path technique for fetches instead.

**For fetch calls:**
Append `-zzz-forced-failure` to the URL path. Safe, genuinely fails, mutates no data.

**Injector discipline:**
- One injector installed at a time. Revert the previous and install the next in a single prompt.
- Gate every revert on a case-insensitive bare-substring grep for `zzz` across the whole file, expecting zero.
- The last verified state must never be a forced failure — always revert and re-run the real happy path before committing.

---

## Pre-Check / Post-Check Gates

Every find-replace edit requires:
1. A grep to count occurrences BEFORE the edit (pre-check).
2. The edit.
3. A grep to count occurrences AFTER (post-check).

State the expected pre and post counts explicitly. If they don't match, STOP and report.

---

## Anchor Rules

- All edit anchors use exact text strings, not line numbers. Line numbers shift constantly.
- Choose anchors long enough to be unique in the file. Verify uniqueness before proposing the edit.
- Re-read the file fresh from disk before every edit — do not rely on content seen earlier in the same session.

**Known anchor-collision hazard — `src/app/profile/page.tsx`:**
Two byte-identical fetch URL lines to `create-connect-account` exist: one in `handleConnectBank`, one in `refreshPayoutsStatus`. The URL line alone will match both. An anchor must reach down to the request body to disambiguate:
- `handleConnectBank` sends `userId, returnUrl:`
- `refreshPayoutsStatus` sends `userId: session.user.id`

---

## React Traps Confirmed in This Codebase

**Closure trap on mount-effect-called functions:** a function declared at component scope closes over render-zero bindings. State set inside a mount effect is still `null` to any function that same effect calls within the same invocation — the running function holds a `const` binding captured at render zero, and a state setter does not update that binding — it schedules a new render with a new binding. The already-executing call keeps seeing null no matter what.

**Rule:** any function callable from a mount effect must fetch its own session via `supabase.auth.getSession()` rather than reading `accessToken` / `userId` from component state.

---

## Verification Environment

- Verification happens in the **browser**, not on a physical device. Hard-refresh (Ctrl+Shift+R) before any check to rule out stale cached JS.
- Next.js dev mode runs **React Strict Mode**, which double-invokes mount effects in development only. **Two identical console lines from a single mount effect is expected behavior, not evidence of two separate calls.** Do not treat this as a bug or as proof of a double-fetch.
- A dev-mode console line carrying `at async init` in its stack came from the
  mount effect; a line without it came from a user action. That distinction
  is the discriminator when verifying that a button handler actually fired.

---

## What This Repo Is Not

- Not fan-facing. Never add a fan-facing route.
- Not the home of Edge Functions. Those live in `MyApp/supabase/functions/`.
- `building` is not a valid concert status. Do not use it.
- The app is not live. No real users exist. Do not frame tracker items as harming customers.
- FTO patent review is required before any public launch.

---

## Schema Changes Are Never Self-Contained

Before proposing any migration that ADDS, RENAMES or DROPS a column the client reads, enumerate and report:

1. Every type declaration describing that row, in BOTH repos.
2. Every `.select(` on that table. **An enumerated `select('a, b, c')` will NOT pick up a new column; `select('*')` will.** This distinction is the whole rule.
3. Whether a hand-synced twin of the touched file exists in the other repo.

State which need changing and which do not. A migration committed without that enumeration is incomplete work, not a finished step.

**Worked example, `close_blocked_reason`.** Added by migration `20260827010000` on 2026-08-27. The iOS screens use `select('*')` and received it for free. The web dashboard query enumerates its columns and would NEVER have fetched it — the badge could not have worked no matter what the UI code said. That gap sat undetected for a full day and took three commits across two days to finish, and only surfaced because Chap asked whether the iOS work needed applying to web.

**TypeScript will not help here.** Supabase returns `any`, so no incoming row is validated against any type. A column that is renamed, added, or dropped produces `undefined` at the consumer with a clean typecheck. Runtime validation at query boundaries is tracked separately as a POST-MVP item.

---

## Lessons Captured from Debugging

- **Two byte-identical `create-connect-account` fetch URLs** in `profile/page.tsx` — disambiguate anchors on the request body, not the URL line.
- **Mount-effect closure trap** — functions called from a mount effect must re-fetch session rather than read state set in that same effect.
- **React Strict Mode double-invocation** in dev is expected and is not itself a defect signal.
- **LF/CRLF git warning is cosmetic** — `core.autocrlf = true`, no `.gitattributes`, tracked separately, do not fix mid-task. But the repo is NOT LF-only; see the Line Endings section.
- **A NEGATIVE status gate silently accepts every status added later; a POSITIVE one does not.** Three instances found in two days, 2026-08-28 and 29. `{(c.status === 'new' || c.status === 'closed') && (` never admitted `closing` when that value arrived. Its iOS counterpart `{!isLive && !isPreview && (` did, and could have taken a closing concert live and deleted its active contributions. The live view badge written as `isPreview ? 'Taking Requests!' : 'LIVE'` claimed LIVE during a close. Same intent, opposite construction, only one safe. **Prefer a positive gate naming the statuses that are allowed.** When a negative gate is genuinely the right shape, name every excluded status explicitly rather than relying on the complement.
- **`isBuilding` and `canEditExistingSongMetadata` in `concerts/[id]/page.tsx` are the two flags that decide live-mode versus closed-mode rendering** for the whole song list. A status missing from either one produces a screen that is half live and half closed — the symptom that made a closing concert show a Manage button leading to Mark as Played.

---

## Environment Quick Reference

| Thing | Value |
|-------|-------|
| Web repo local path | `C:\Users\chapl\setlistweb` |
| Web repo remote | `Patiosquad/MyInteractiveSetlistWebApp` |
| iOS repo local path | `C:\Users\chapl\MyApp` |
| Supabase project ref | `aeghdjuxysiczvypcdfd` |
| Test Performer | cat@settuner.com |
| Hosting | Vercel (auto-deploy on push to main = production) |
| TypeScript baseline | 0 |

---

## Who Decides What

Chap owns what SetTuner DOES. What a fan sees, what is allowed, where the money goes, what counts as acceptable friction. Claude owns HOW IT GETS THERE. Schema, queries, file layout, line endings, how a change is verified.

When a technical choice carries a product consequence, name the consequence in Chap's terms and ask about THAT — never about the mechanism. Do not ask him to choose between an error code and a decline code, one column or two, or an embed versus two queries. Ask what should happen to the fan and the money, then decide the mechanism.

Two answers from 2026-08-29 show what this buys, and both are worth reading as examples of the level to ask at:
- "A closing concert is definitionally closed except payouts haven't finished." One sentence, thirteen code sites resolved.
- "As long as there are no holds then the fan can remove the card that moment." The question had been framed around concert status; reframing it around money was the correct answer and produced a narrower, better rule.

**WHEN UNSURE ABOUT A FACT, GO MEASURE. DO NOT ASK.** Whether accepted survives a charge, whether a foreign key exists, what a query returns, what line endings a file has — those are answers to be read from the code, the schema or a controlled run, never guessed at and never handed to Chap. He catches wrong guesses during device testing, which is slower than reading would have been. This does NOT extend to product intent: measure facts, ask about intent.

**CONTROLLED RUNS BEAT REASONING.** Suppress one thing, change nothing else, look. On 2026-08-29 every finding that survived came from that method and every one that did not came from being confident about something unchecked.

---

## Lessons Capture Rule

At the end of any session where a new technical trap, anti-pattern, or hard-won finding is discovered, append it to the "Lessons Captured from Debugging" section above before the session summary is generated — sourced from a verified code read, never from a tracker title or prior prose summary.