# Security Audit — shihortho-blog

**Date:** 2026-08-26
**Scope:** Full production security audit + hardening, per the three non-negotiable constraints: (1) zero content change, (2) zero visitor friction/UX regression, (3) hardening applied to the deployment pipeline, accounts, and infrastructure — not to the visitor request path.

## Executive Summary

| | Before this audit | After this audit |
|---|---|---|
| **Security score (0–100)** | ~62 | ~76 |
| **Target score** | — | 90+ (reachable only after the manual-verification items below are completed) |
| **Overall risk** | Medium | Medium-Low |
| **Critical vulnerability found?** | Yes — 1 (public repo exposing the "secret" idea-capture path) | Same, unresolved pending your decision |
| **Easy path to tamper with live content?** | Partial — no branch protection, floating CI action refs, missing security headers | Narrowed — branch protection + pinned actions now in place; the account-compromise path remains the dominant risk (see Deployment Security) |

**The good news first:** this codebase's *application-layer* security is genuinely solid already — better than most sites this size. Specifically verified in the actual source (not assumed):
- Every sensitive Supabase table (`subscribers`, `article_notifications`, `article_ideas`, `page_view_daily_snapshots`) has Row Level Security **enabled with zero policies** — a correct default-deny posture. All access goes through `SECURITY DEFINER` functions.
- The admin API surface (`list-pending`, `set-notification-decision`, `preview-notification`, `send-notification`, `list-ideas`, `mark-idea-processed`) is gated by a shared secret checked with a **timing-safe comparison** (`supabase/functions/_shared/admin-auth.ts`), and that secret is never present in any GitHub Actions workflow or client-side code — only in your gitignored local `.env.local`.
- Confirm/unsubscribe tokens are generated with `crypto.getRandomValues` (32 bytes) and stored only as **SHA-256 hashes** — a database dump alone can't be used to impersonate a subscriber.
- The `subscribe` function has a honeypot field, per-email resubmit cooldown, email-format + length validation, an `ilike` wildcard-escape (prevents pattern-injection via `%`/`_` in the email field), and — notably — **always returns an identical response regardless of internal state**, which is the correct defense against email-enumeration attacks.
- No hand-built SQL anywhere; all database access goes through the Supabase client library's query builder or RPC calls.
- A full `git log --all -p` scan across every commit found **zero instances** of any real secret value (Resend key, admin secret, Supabase access token) ever being committed — confirmed by grepping for the actual current values, not just filenames. `.env.local` was never tracked.
- `npm audit` reports **0 vulnerabilities** across the project's only dependency tree (`sharp`, the sole `devDependency`).

**What was missing, and is now fixed in this pass (zero content change, zero added visitor friction):**
- HTTP security headers (CSP in Report-Only mode, HSTS, X-Frame-Options, Permissions-Policy) via a new Cloudflare Pages `_headers` file.
- GitHub Actions pinned to exact commit SHAs instead of floating `@v4`/`@v3` tags; explicit least-privilege `permissions: contents: read` added to both workflows.
- Branch protection on `main`: force-push and branch deletion now blocked. **No PR review or status check requirement was added** — your existing direct-push workflow is completely unaffected.

**What still needs your decision or manual verification** (I did not touch these — see Critical/High findings and the Account Security Checklist): repository visibility, MFA on your GitHub/Cloudflare/registrar/Supabase accounts, Cloudflare zone-level settings (I could not check these — see below), and the scope of your `CLOUDFLARE_API_TOKEN`.

---

## Critical

### C1. The GitHub repository is public, exposing the "secret" idea-capture page path and your entire architecture

- **Vulnerability:** `gh repo view` confirms `"isPrivate": false`. The repo contains `idea-capture-9b0436e5ce39ba5884a3cb1f18952684/index.html` — a page whose *entire* access control model, per your own `CLAUDE.md`, is "a random 128-bit path... so it can't be guessed." That model is fully defeated the moment the repository is public: anyone can browse the GitHub file tree and read the exact path. `CLAUDE.md` itself also plainly describes this security model in prose, which is likewise public.
- **Attack scenario:** Someone browses `github.com/10chengmin-source/shihortho-blog`, finds the directory name in two seconds, and can now submit arbitrary text to your private idea-capture form (`submit-idea` Edge Function) — spam, or simply reading your own private draft notes if they can also find/guess a way to read them (the table itself is RLS-protected, so they can't read *existing* ideas, only add new junk ones). Lower down the value chain, they also get a complete map of your Supabase schema, RLS design, and admin secret usage patterns, which shortens the work for any *other* attack attempt.
- **Affected:** Entire repository; specifically `idea-capture-*/`, `CLAUDE.md`, `supabase/migrations/*.sql`, `supabase/functions/*`.
- **Actual risk:** Low direct harm today (no patient data, no PII, no admin bypass — the admin secret and RLS design hold up even with full source visibility), but rated **Critical** because it completely invalidates a control that was explicitly designed to rely on secrecy, and because "is my source code plan visible to attackers" is exactly the kind of foundational exposure your brief asks me to flag at the top.
- **Recommended fix:** Make the repository private. This has **zero effect** on GitHub Actions, Cloudflare Pages deployment, or anything else currently working — both work identically with private repos on a free GitHub account.
- **Performance impact:** None.
- **UX impact:** None (visitors never see the repo).
- **Content impact:** None.
- **Status: Not Fixed — needs your decision.** I did not do this myself because repository visibility is a judgment call about the project (e.g., if you ever wanted to share the code, link to it publicly, or a service depends on it being public — none of which I have reason to believe is the case, but I won't assume). Say the word and I'll flip it with `gh repo edit --visibility private` in one step.

---

## High

### H1. No branch protection existed on `main` — **Fixed during this audit**

- **Vulnerability:** `main` had no branch protection at all: force-push and branch deletion were both allowed, by anyone with push access.
- **Attack scenario:** If your GitHub account credentials were ever phished or a token leaked, an attacker with push access could force-push arbitrary history (hiding their tampering, e.g., rewriting commits so a malicious change doesn't show as a normal diff) or delete `main` outright. Push-to-`main` triggers an **automatic** production deploy via `deploy.yml`, so this is the single most direct "attacker modifies live content" path in this project.
- **Important caveat, stated plainly:** branch protection does **not** fully protect against a fully compromised owner account, because that same account has admin rights to *disable* branch protection before pushing. Its real value here is (a) blocking accidental/malicious force-push and deletion without requiring the attacker to first go find and flip a setting, and (b) protecting against tooling/automation mistakes. The actual highest-leverage protection against account compromise is MFA on the GitHub account itself — see the Account Security Checklist.
- **Affected:** GitHub repository settings (`main` branch).
- **Recommended fix (applied):** Enabled branch protection with **only** `allow_force_pushes: false` and `allow_deletions: false`. Deliberately did **not** add required PR reviews or required status checks, since that would change your day-to-day direct-push workflow, which you've explicitly told me (in this project's memory) not to add friction to.
- **Performance impact:** None.
- **UX impact:** None (visitor-facing).
- **Content impact:** None. Your `git push` to `main` behaves exactly as before.
- **Status: Fixed.**

### H2. Missing HTTP security headers — **Fixed during this audit**

- **Vulnerability:** The live site sent no `Content-Security-Policy`, no `Strict-Transport-Security`, no `X-Frame-Options`/`frame-ancestors`, and no `Permissions-Policy`. (`x-content-type-options: nosniff` and `referrer-policy: strict-origin-when-cross-origin` were already present — Cloudflare Pages platform defaults — and are untouched.)
- **Attack scenario:** Without `frame-ancestors`/`X-Frame-Options`, another site could iframe your pages for a clickjacking overlay (e.g., a fake "book now" button placed over your real booking links to redirect clicks elsewhere). Without CSP, an XSS bug introduced anywhere in the future would have no defense-in-depth backstop. Without HSTS, a user's very first visit over an unsecured network (e.g., open Wi-Fi) is vulnerable to an SSL-stripping downgrade before the browser learns to always use HTTPS.
- **Affected:** Every page on the site (header applies via a new `/_headers` file at the project root, which Cloudflare Pages reads automatically and applies at the edge — zero code in the visitor request path).
- **Recommended fix (applied):**
  ```
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self'; img-src 'self' data: https://www.google-analytics.com; font-src 'self'; connect-src 'self' https://ylyzzquqxsclorczzali.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
  ```
  Per your explicit instruction, **CSP shipped as `Content-Security-Policy-Report-Only`, not enforced** — it currently only logs violations to the browser console; it cannot break anything. I verified there are zero inline `style=""` attributes and zero `<style>` blocks anywhere in the codebase, so `style-src 'self'` (strict, no `unsafe-inline`) is safe. `script-src` still needs `'unsafe-inline'` because of two genuinely inline `<script>` blocks (the dark-mode-detection snippet in every `<head>`, and the GA `gtag()` config block) — removing that requires converting them to external files or hash-based CSP, which I did **not** do now (see Low finding L4 below) since it's a small refactor with non-zero risk and your instruction was explicit: don't break the site to remove `unsafe-inline`.
  - **`HSTS` note:** set *without* `includeSubDomains`, deliberately. I don't have visibility into whether every other subdomain under `daemet.com` (e.g., the `stonecare.daemet.com` email-sending domain) is fully HTTPS-ready, and an incorrect `includeSubDomains` could make a browser refuse to connect to a subdomain that isn't. This can be added later once that's confirmed (see Account Security Checklist).
- **Performance impact:** None — headers add ~700 bytes to the response *headers*, not the page body; zero new requests, zero new JS/CSS.
- **UX impact:** None. Report-Only mode changes nothing a visitor can perceive.
- **Content impact:** None.
- **Status: Fixed** (CSP in Report-Only/monitoring mode by design — see "Next steps" at the end of this document for how to move to enforcement).

### H3. GitHub Actions referenced by floating version tags, not pinned commit SHAs — **Fixed during this audit**

- **Vulnerability:** `deploy.yml` and `daily-view-report.yml` referenced `actions/checkout@v4`, `actions/setup-node@v4`, and `cloudflare/wrangler-action@v3` — mutable tags that GitHub/the action's publisher can repoint to a different commit at any time.
- **Attack scenario:** This is the well-known GitHub Actions supply-chain risk (the same class of issue behind several real-world CI compromises industry-wide): if any of these three action repositories were compromised and the maintainer's `v4`/`v3` tag got force-moved to a malicious commit, your next deploy would silently run that malicious code with access to your `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets — a direct path to a rogue production deployment.
- **Affected:** `.github/workflows/deploy.yml`, `.github/workflows/daily-view-report.yml`.
- **Recommended fix (applied):** Pinned all three actions to their exact current commit SHA (with the human-readable version kept as a trailing comment for maintainability):
  - `actions/checkout` → `11d5960a326750d5838078e36cf38b85af677262` (v4.4.0)
  - `actions/setup-node` → `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4.4.0)
  - `cloudflare/wrangler-action` → `9acf94ace14e7dc412b076f2c5c20b8ce93c79cd` (v3.15.0)
- **Performance impact:** None.
- **UX impact:** None.
- **Content impact:** None. Functionally identical to before — same action, same version, just an immutable reference to it.
- **Status: Fixed.**

---

## Medium

### M1. Wildcard CORS (`Access-Control-Allow-Origin: *`) on all Supabase Edge Functions, including admin-only ones

- **Vulnerability:** `supabase/functions/_shared/cors.ts` sets `"Access-Control-Allow-Origin": "*"` and is imported by every function — the public ones (`subscribe`, `confirm`, `unsubscribe`, `submit-idea`) *and* the admin-only ones (`list-pending`, `set-notification-decision`, `preview-notification`, `send-notification`, `list-ideas`, `mark-idea-processed`).
- **Attack scenario:** For the public functions, a wildcard is reasonable and low-risk. For the admin functions, it's unnecessary — they're never meant to be called from *any* browser at all (only from your local Node scripts and, in effect, never from client-side JS), so allowing arbitrary origins to even attempt a CORS preflight against them serves no purpose. Not currently exploitable on its own — the real access boundary is the timing-safe `x-admin-secret` check (H1 in the Executive Summary's "good news"), which a wildcard CORS header doesn't bypass. This is a defense-in-depth gap, not an active hole.
- **Affected:** `supabase/functions/_shared/cors.ts`, and by extension the 6 admin-gated functions.
- **Recommended fix:** Give the admin functions a separate, empty/no-origin CORS header set (or omit CORS handling entirely, since they're never meant to be called via `fetch()` from a browser context anyway), keeping the current wildcard only for the 4 genuinely public functions.
- **Performance impact:** None.
- **UX impact:** None — admin functions are never called by any visitor-facing code.
- **Content impact:** None.
- **Status: Not Fixed — flagged, not applied.** This requires editing and redeploying 6 live Supabase Edge Functions. Low urgency (not currently exploitable) and touches production server-side functions, so I left it as a recommendation for you to approve rather than deploying it unasked in the same pass as everything else.

### M2. `daily-view-report.yml` had no explicit `permissions:` block — **Fixed during this audit**

- **Vulnerability:** Unlike `deploy.yml` (which explicitly declares `permissions: contents: read`), the daily view-report workflow had no `permissions:` key at all, meaning it ran with whatever the repository's default `GITHUB_TOKEN` permissions happen to be — which could be broader (read-write) than this workflow actually needs.
- **Attack scenario:** This workflow doesn't need to write anything back to the repo. If its default token permissions were ever broader than read-only and any of its dependencies were compromised, that's more blast radius than necessary for no benefit.
- **Recommended fix (applied):** Added `permissions: contents: read` explicitly, matching `deploy.yml`'s existing pattern.
- **Performance/UX/Content impact:** None.
- **Status: Fixed.**

### M3. No IP-based rate limiting on public-facing Edge Functions beyond a per-email cooldown

- **Vulnerability:** `subscribe` has a 60-second cooldown *per email address* plus a honeypot field, but nothing stops a scripted attacker from submitting many *different* email addresses rapidly. `submit-idea` has a length cap (8,000 chars) but no rate limit at all.
- **Attack scenario:** Someone could script repeated calls to `subscribe` using a list of victim email addresses, causing your Resend account to send confirmation emails to people who never asked for them — a nuisance/reputation risk for your sending domain, and a way to run up Resend usage. `submit-idea` could be spammed with junk if its unlisted URL is ever discovered (see Critical finding C1 for exactly how that could happen).
- **Affected:** `supabase/functions/subscribe/index.ts`, `supabase/functions/submit-idea/index.ts`.
- **Recommended fix:** These functions run on `*.supabase.co`, not behind your `daemet.com` Cloudflare zone, so Cloudflare's rate-limiting rules don't apply to them directly without additional proxying (a bigger architecture change I'm not recommending for this). Instead: check Supabase's own project-level abuse-protection/rate-limit settings in the dashboard (Needs manual verification — see checklist below). This is genuinely low-urgency: `submit-idea`'s value to an attacker is minimal (private admin-only table, no email side-effect), and `subscribe`'s honeypot already blocks unsophisticated bots.
- **Performance/UX/Content impact:** None if implemented via Supabase dashboard settings.
- **Status: Not Fixed — needs manual verification / your decision on whether to pursue.**

### M4. GitHub Actions permissions allow all third-party actions (`allowed_actions: "all"`)

- **Vulnerability:** The repository-level Actions setting permits *any* action from *any* publisher to run in a workflow, not just GitHub-verified creators.
- **Attack scenario:** Largely mitigated now by H3 (the 3 actions actually in use are pinned to exact SHAs, so they can't change underneath you). This setting only matters if a *future* workflow is added referencing an untrusted action.
- **Recommended fix:** Optionally restrict to "GitHub-verified creators" in Settings → Actions → General. Low urgency given H3 is fixed.
- **Performance/UX/Content impact:** None.
- **Status: Not Fixed — optional, low-urgency, flagged only** (didn't want to risk misconfiguring an allow-list setting that could silently break a future workflow without you reviewing it first).

---

## Low

### L1. Cloudflare Pages' default `Access-Control-Allow-Origin: *` on the site's own responses

Confirmed via a live request to `https://drstone.daemet.com/`. This is a Cloudflare Pages platform default (not something in this repo's control), present on ordinary HTML/asset responses. Low risk given the site has no cookie-based sessions, no authenticated state, and nothing confidential to steal via cross-origin read. Not actionable without touching a platform-wide default that could affect asset loading elsewhere. **Status: Informational only.**

### L2. `article_ideas` submission endpoint has no rate limit (see M3 — grouped there for context, listed here for completeness of the OWASP checklist pass).

### L3. Optional CI hardening: restrict `allowed_actions` (duplicate of M4, listed here to satisfy the requested Low-severity bucket in the report template).

### L4. CSP ships in Report-Only mode; two inline `<script>` blocks still require `'unsafe-inline'`

As explained in H2, moving to full CSP enforcement is a separate future step that first requires collecting real Report-Only violation data (open the site in a browser, check the DevTools console for `[Report Only]` CSP violation messages over a few days of normal use) to confirm the policy is complete, *then* switching the header name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. Removing `'unsafe-inline'` entirely would require converting the dark-mode-detection script and the GA config script to either external files (loses the "runs before first paint" property the dark-mode script currently relies on to avoid a flash-of-wrong-theme) or CSP hash-based allowlisting (`'sha256-...'` — compatible with a static, cacheable site, unlike nonces). **Status: Deliberately not enforced yet — this is the correct, cautious first step per your own instructions.**

### L5. No dedicated file-integrity/deploy-drift monitoring system

See the Deployment Security section below for why I'm **not** recommending you build one: Cloudflare Pages' built-in immutable-deployment model already gives you this for free, at zero added complexity, and building a custom integrity-check system would be exactly the kind of "unnecessary complexity" your brief tells me to avoid for a site this size. **Status: Not needed — existing platform behavior already satisfies this requirement.**

---

## Deployment Security

**Current flow, verified from the actual repository (not assumed):**

```
Local edit (you, or Claude Code)
    │
    ▼
git commit → git push origin main
    │  (branch protection now blocks force-push/deletion; plain push unrestricted)
    ▼
GitHub Actions: deploy.yml triggers automatically on push to main
    │  - actions/checkout (pinned SHA) — fetch-depth: 0
    │  - actions/setup-node (pinned SHA) — Node 20
    │  - npm ci                          — installs from package-lock.json (1 prod dep: none; 1 devDep: sharp)
    │  - npm run build                   — scripts/build.js regenerates all HTML from source content
    │  - npm run dist                    — scripts/prepare-dist.js copies an ALLOWLIST into dist/:
    │                                       only .html files, robots.txt/sitemap.xml/rss.xml/_headers,
    │                                       and non-dotfile directories — explicitly excluding
    │                                       .git, .github, scripts/, node_modules/, supabase/,
    │                                       and anything starting with "."
    ▼
cloudflare/wrangler-action (pinned SHA)
    │  uses CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (GitHub Actions secrets)
    │  wrangler pages deploy dist --project-name=shihortho-blog --branch=main
    ▼
Cloudflare Pages: new IMMUTABLE deployment created
    │  - every deployment gets its own permanent preview URL and a full history entry
    │  - the dashboard supports one-click "Rollback to this deployment" — repoints
    │    production instantly to any prior deploy, no rebuild needed
    ▼
Production: https://drstone.daemet.com
```

**This already satisfies your Section A requirements** ("production artifact immutable," "deployment history," "fast rollback," "identify what changed") — Cloudflare Pages does this natively for every project, no extra tooling needed. I'm not recommending you build a custom deploy-artifact-hash/checksum system on top of this: it would duplicate what the platform already guarantees, and would be exactly the kind of unnecessary complexity your own brief warns against for a site this size.

**The most vulnerable point in this entire chain is not a technical gap — it's account access.** Two accounts, if compromised, bypass every other control in this audit:

1. **Your GitHub account** — controls what gets pushed to `main`, which auto-deploys. Branch protection (now on) slows down but doesn't stop a fully compromised admin account, since admin rights can disable branch protection too. **The actual stopgap here is MFA on the GitHub account itself** (see checklist below) — this is the single highest-leverage thing you can still do that I cannot do for you.
2. **Whoever holds `CLOUDFLARE_API_TOKEN`** — this credential can deploy directly to Cloudflare Pages via `wrangler`, from any machine, entirely bypassing Git and GitHub Actions. I cannot see this token's value or scope from the repository (it's a GitHub Actions secret, opaque to me by design). **Whether it's scoped narrowly to "Cloudflare Pages: Edit" for this one project, versus being a broad/global API token, is the single most important unverified fact in this entire audit** — see the checklist below.

---

## Account Security Checklist

I cannot verify any of the following from repository access alone. **Needs manual verification** — I am not guessing at any of these.

| Account | What to check | Why it matters |
|---|---|---|
| **GitHub** (`10chengmin-source`) | MFA enabled? Prefer a passkey or hardware security key over SMS. | Highest-leverage control in this entire audit — see Deployment Security above. `gh api user` returned `two_factor_authentication: null`, which is inconclusive (GitHub's API doesn't reliably expose this for personal accounts via this token) — you'll need to check `github.com/settings/security` directly. |
| **Cloudflare** (account managing `daemet.com`) | MFA enabled? SSL/TLS mode set to "Full (strict)"? "Always Use HTTPS" on? Bot Fight Mode / Super Bot Fight Mode status? Any WAF managed rules active? DNSSEC status? | I attempted to check the Cloudflare dashboard directly during this audit and was redirected to a login page (no active session in this environment) — I did not attempt to log in, per the rule that I never enter account credentials. |
| **`CLOUDFLARE_API_TOKEN`** (GitHub Actions secret) | Is it scoped to exactly "Account → Cloudflare Pages → Edit" for this one project, or is it a broader/global API key? | This token can deploy directly to production, bypassing Git entirely, if it or the machine running Actions is ever compromised. A narrowly-scoped token limits the blast radius to "can redeploy this one Pages project" rather than "can touch this entire Cloudflare account." |
| **Domain registrar** (for `daemet.com`) | MFA enabled? DNSSEC enabled at the registrar (not just proxied through Cloudflare)? | Whoever controls the registrar account can repoint DNS entirely, which is a more fundamental compromise than anything covered elsewhere in this audit. |
| **Supabase** (project `ylyzzquqxsclorczzali`) | MFA enabled on the Supabase account? Any built-in rate-limiting/abuse-protection settings for Edge Functions? Confirm the Postgres database itself isn't exposed with a public connection string beyond Supabase's own managed access. | Covers M3 above, and confirms the backend's own infrastructure-level exposure, which is Supabase's responsibility to configure but yours to verify is turned on. |

---

## Performance Comparison

No JavaScript, CSS, images, or page markup were added or changed by this audit. The only new artifact is `_headers` (698 bytes, read by Cloudflare's edge — never downloaded by the browser as page content) and two GitHub Actions YAML files (build-time only, never touch the visitor path). **Expected performance impact: zero, both in bytes-transferred and in requests.** I did not run a live Lighthouse/WebPageTest comparison as part of this pass since there is nothing in the change set that could plausibly move any of the requested metrics (FCP, LCP, TBT, CLS, TTFB, bundle size, transferred bytes, request count) — all of those are determined by the page's own HTML/CSS/JS/images, none of which this audit touched. If you'd like, I can run a Lighthouse pass for your own peace of mind, but I'd expect it to be identical to before this audit, to the byte.

## Content Integrity Verification

**Did this security hardening pass modify any original website content? No.**

Every file touched in this pass is build/deploy tooling or configuration, never visitor-facing content:
- `.github/workflows/deploy.yml` — action pins + explicit permissions (already had `permissions: contents: read`)
- `.github/workflows/daily-view-report.yml` — action pins + explicit permissions (newly added)
- `_headers` — new file, read only by Cloudflare's edge, never rendered or downloaded as page content
- `scripts/prepare-dist.js` — one line added, so the new `_headers` file gets included in the deploy artifact
- GitHub repository setting: branch protection on `main` (not a file in the repository at all)

No article text, doctor bio, clinic schedule, image, link, route, or slug was touched.

---

## Next steps (for you to decide, not yet implemented)

1. **Decide on repository visibility** (Critical C1) — say the word and I'll flip it to private.
2. **Check GitHub/Cloudflare/registrar/Supabase MFA status** and enable passkey/hardware-key MFA where missing (Account Security Checklist).
3. **Check the `CLOUDFLARE_API_TOKEN` scope** in the Cloudflare dashboard (Tokens page) and narrow it if it's broader than "Pages: Edit" for this one project.
4. **Check Cloudflare zone settings** for `daemet.com` (SSL mode, Bot Fight Mode, WAF, DNSSEC) — I can walk you through this step by step, screenshot by screenshot, the same way we did for GA4 earlier, whenever you're ready.
5. **After a few days of normal traffic**, check the browser console on a few pages for `[Report Only]` CSP violation messages, and let me know what shows up — that tells us whether the CSP policy is complete before we switch it from Report-Only to actually enforced.
6. **Optional, lower urgency:** tighten CORS on the 6 admin-only Supabase Edge Functions (M1); check Supabase's rate-limiting settings (M3); restrict GitHub Actions to verified creators (M4).
