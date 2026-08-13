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

- **Baseline is ZERO.** Any `error TS` line at all is a regression — there is no pre-existing exception list in this repo.
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

This repo is LF-only on disk but has `core.autocrlf = true` and no `.gitattributes`. Git will warn `LF will be replaced by CRLF` on every diff. **This is cosmetic and tracked separately — do not attempt to resolve it mid-task.** Files remain LF on disk regardless of the warning.

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

## Lessons Captured from Debugging

- **Two byte-identical `create-connect-account` fetch URLs** in `profile/page.tsx` — disambiguate anchors on the request body, not the URL line.
- **Mount-effect closure trap** — functions called from a mount effect must re-fetch session rather than read state set in that same effect.
- **React Strict Mode double-invocation** in dev is expected and is not itself a defect signal.
- **LF/CRLF git warning is cosmetic** — `core.autocrlf = true`, no `.gitattributes`, tracked separately, do not fix mid-task.

---

## Environment Quick Reference

| Thing | Value |
|-------|-------|
| Web repo local path | `C:\Users\chapl\setlistweb` |
| Web repo remote | `Patiosquad/MyInteractiveSetlistWebApp` |
| iOS repo local path | `C:\Users\chapl\MyApp` |
| Supabase project ref | `aeghdjuxysiczvypcdfd` |
| Test Performer | cat@gmail.com |
| Hosting | Vercel (auto-deploy on push to main = production) |
| TypeScript baseline | 0 |

---

## Lessons Capture Rule

At the end of any session where a new technical trap, anti-pattern, or hard-won finding is discovered, append it to the "Lessons Captured from Debugging" section above before the session summary is generated — sourced from a verified code read, never from a tracker title or prior prose summary.