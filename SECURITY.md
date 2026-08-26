# Security architecture — shihortho-blog

This document describes the current production security architecture. It's a living reference — update it whenever the architecture, deployment flow, or security configuration changes. See `SECURITY_AUDIT.md` for the point-in-time audit that established this baseline (2026-08-26) and its full list of findings/recommendations.

## Architecture

Fully static site — no framework, no server-side rendering, no traditional CMS, no admin web interface. Every page is a hand-authored/build-generated `.html` file. The only backend is a thin Supabase layer (Postgres + Edge Functions) for three narrow features: a page-view counter, an article-notification subscription system, and a private mobile idea-capture form. There is deliberately no database, no CMS, and no authentication server beyond what those three features need — adding any of that would be unnecessary complexity for a public information site.

## Deployment flow

```
git push origin main
  → GitHub Actions (deploy.yml, action versions pinned to commit SHA)
    → npm ci && npm run build && npm run dist
    → cloudflare/wrangler-action deploys dist/ to Cloudflare Pages
  → Cloudflare Pages: new immutable, versioned deployment; instant one-click rollback available in the dashboard
```

`scripts/prepare-dist.js` copies an **allowlist** into `dist/` (only `.html` files, `robots.txt`/`sitemap.xml`/`rss.xml`/`_headers`, and non-dotfile directories) — `.git`, `.github`, `scripts/`, `node_modules/`, `supabase/`, and any dotfile (including `.env.local`) are structurally excluded from ever reaching the deployed artifact, regardless of what exists in the working tree.

## Source control

- Repository: `github.com/10chengmin-source/shihortho-blog`
- **Branch protection on `main`:** force-push and branch deletion blocked. No required PR review or status check — direct push remains the normal workflow.
- GitHub Actions pinned to exact commit SHAs (not floating version tags) — see `.github/workflows/*.yml`.
- ⚠️ **Repository visibility is currently public.** See `SECURITY_AUDIT.md` Critical finding C1 — this is a known, flagged, not-yet-resolved gap pending an explicit decision.

## Authentication / admin access

There is no public admin web interface. All administrative actions (deciding whether to notify subscribers about a new article, viewing pending decisions, marking an idea processed) happen through local Node scripts (`scripts/notifications-*.js`, `scripts/ideas-*.js`) run manually from a machine with a gitignored `.env.local`, which calls admin-gated Supabase Edge Functions using a shared secret (`ADMIN_SECRET`) sent as an `x-admin-secret` header.

- The admin secret is checked with a **timing-safe comparison** (`supabase/functions/_shared/admin-auth.ts`).
- The admin secret is never present in any GitHub Actions workflow, any client-side JavaScript, or anywhere in git history.
- Admin-gated functions: `list-pending`, `set-notification-decision`, `preview-notification`, `send-notification`, `list-ideas`, `mark-idea-processed`.

## Secrets management

| Secret | Lives in | Never appears in |
|---|---|---|
| `ADMIN_SECRET` | Gitignored `.env.local` only, read by local Node scripts | GitHub Actions, client JS, git history |
| `SUPABASE_ANON_KEY` | Client-side JS (`assets/js/supabase-config.js`) | — intentionally public; protected by RLS, not secrecy |
| `RESEND_API_KEY` | GitHub Actions secret + gitignored `.env.local` | Client JS, git history |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function runtime (auto-injected by Supabase, never set by hand) | This repository, in any form, ever |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secrets | Client JS, git history, local `.env.local` |
| `SUPABASE_ACCESS_TOKEN` | Local `.env.local` only (used for `supabase db push` from a developer machine) | GitHub Actions, client JS, git history |

A full history scan (`git log --all -p`, grepped against the actual current values of every secret above) confirms none has ever been committed.

## Database (Supabase) security

Every table added since the RLS-aware design (`subscribers`, `article_notifications`, `article_ideas`, `page_view_daily_snapshots`) has **Row Level Security enabled with zero policies** — the correct default-deny posture. All reads/writes for these tables go through `SECURITY DEFINER` Postgres functions or Edge Functions using the service-role key, never direct anon/authenticated table access.

The legacy `page_views` table (view counter) intentionally allows anon `SELECT` — it holds only aggregate view counts per article, no PII, so this is an accepted low-sensitivity exception, not an oversight.

## CDN / hosting

Cloudflare Pages, in front of `drstone.daemet.com` (Cloudflare zone: `daemet.com`). Zone-level settings (SSL mode, WAF, Bot Fight Mode, DNSSEC) require dashboard access to verify and were **not** independently confirmed in this pass — see `SECURITY_AUDIT.md`'s Account Security Checklist.

## HTTP security headers

Set via `/_headers` at the project root (Cloudflare Pages' native mechanism — applied at the edge, zero code in the visitor request path):

- `Content-Security-Policy-Report-Only` — monitoring mode; not yet enforced. See `SECURITY_AUDIT.md` finding L4 for the path to enforcement.
- `Strict-Transport-Security: max-age=31536000` — deliberately without `includeSubDomains` until every `daemet.com` subdomain's HTTPS readiness is confirmed.
- `X-Frame-Options: DENY`
- `Permissions-Policy` — disables camera, microphone, geolocation, payment, USB, and motion-sensor APIs, none of which this site uses.

Cloudflare Pages platform defaults already provide `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` without any configuration on our part.

## Backup / rollback

Cloudflare Pages retains every past deployment as an immutable, individually-addressable artifact, with one-click rollback in the dashboard. This is the project's disaster-recovery mechanism for "bad deploy" or "content tampered with" scenarios — no separate backup system exists or is currently recommended, since building one would duplicate what the platform already guarantees for free.

Source content itself is backed up implicitly by git history (every commit is a full snapshot, hosted both locally and on GitHub).

## Monitoring

- Google Analytics 4 (`G-5S2TFQGC2L`) — visitor analytics only, no security event logging.
- No dedicated security-event logging (admin logins, failed auth attempts, deployment events) exists today. Given the small admin surface (one operator, no web-based admin login to log failed attempts against), this has not been prioritized — flag for future consideration if the admin surface grows.

## Incident response (if content is ever found tampered with)

1. Do not panic-edit the live site directly — there is no "direct edit" path in normal operation, so if content changed unexpectedly, treat it as a possible account compromise, not a typo.
2. In the Cloudflare Pages dashboard, use "Rollback to this deployment" to instantly revert to the last known-good deployment while investigating — no rebuild required.
3. Check recent GitHub Actions runs (`gh run list`) and recent commits on `main` (`git log`) for anything you don't recognize authoring.
4. If a commit you didn't make appears: rotate `CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, and any other GitHub Actions secret immediately (regenerate in each service's dashboard, then `gh secret set`), and check GitHub account security (`github.com/settings/security`) for unrecognized sessions or SSH/personal-access-token entries.
5. Re-verify branch protection on `main` is still active (an attacker with admin access could have disabled it).
