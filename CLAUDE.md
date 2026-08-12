# Article notification workflow

This project has an article-notification subscription system (Supabase Edge
Functions under `supabase/functions/`, admin scripts under
`scripts/notifications-*.js`). These rules govern how Claude Code must use
it. They are durable — they apply in every future session, not just the one
that built this system.

## The three-way publish decision

Publishing an article and notifying subscribers are two independent
decisions. When a new article is first published (a new article directory
merged to `main`), ask the user explicitly — do not infer or assume:

1. **發布並通知 / notify now** — record the decision, then immediately run
   the send flow (`scripts/notifications-send.js <slug>` for the preview,
   confirm the counts with the user, then `--confirm` to actually send).
2. **發布，但稍後再決定 / decide later** — record as pending and stop. This
   article's decision is not yet made.
3. **發布，不通知 / never notify** — record as `do_not_send` and stop. This
   article should never be asked about again.

Record every decision with `scripts/notifications-decide.js <slug>
<now|later|never>` right after the user answers. Never skip this — an
unrecorded decision means the article silently falls back to "never asked",
which is wrong.

## Hard rules

- **Ask at most once per session.** If `scripts/notifications-pending.js`
  (or the `SessionStart` hook's injected context) surfaces an article
  that's still `pending`, ask about it once. If the user defers again, do
  not ask again in the same session. Do not ask again in a *later* session
  either unless the user has not yet resolved it — pending articles keep
  resurfacing, once per session, until decided.
- **Never auto-decide, auto-expire, or auto-reset a `pending` article.**
  There is no strike limit and no timeout. A `pending` article stays
  `pending` — forever, if that's how long it takes — until the user
  explicitly says now or never.
- **Never re-prompt a `do_not_send` article** unless the user explicitly
  asks to override that specific article's decision. Don't ask "are you
  sure" as a matter of routine.
- **Routine edits never re-trigger the question.** Fixing a typo, updating
  images, adjusting SEO metadata, rebuilding, redeploying, or pushing a
  commit to an *already-published* article must never change its
  notification status or prompt the question again. The question only
  applies to genuinely new articles.
- **A `sent` article is immutable without explicit resend confirmation.**
  `scripts/notifications-send.js` already enforces this at the API level
  (`--acknowledge-resend-of=<timestamp>` required, checked against the real
  stored `sent_at`) — never work around it by calling the Edge Function
  directly or fabricating the acknowledgment value.
- **Always show a preview before sending.** Run
  `scripts/notifications-send.js <slug>` without `--confirm` first, relay
  the subscriber counts to the user, and only pass `--confirm` after they
  approve.

## Where the state actually lives

All of this is real Supabase data (`article_notifications`,
`subscribers` tables), not something Claude remembers across sessions. If
`.env.local` is missing or Supabase is unreachable, the admin scripts and
the `SessionStart` hook fail silently/harmlessly — they must never block
other work. When in doubt about an article's actual status, run
`npm run notifications:pending` rather than trusting conversation history.

# Mobile article-idea capture

`notes/index.html` is a private, unlisted page (not linked from any nav,
`noindex`) where the user jots raw article ideas from their phone —
typed or via voice-to-text. Submissions land in the `article_ideas`
Supabase table via the `submit-idea` Edge Function.

A `SessionStart` hook (`scripts/ideas-session-hook.js`) surfaces any
unprocessed idea automatically at the start of a session, the same way
pending notifications do. When one shows up: discuss it with the user,
help turn it into an article if they want to, and once it's been used (or
they say to drop it) mark it with `scripts/ideas-mark-processed.js <id>` so
it stops resurfacing. `npm run ideas:pending` checks manually. Unlike
notification decisions, there's no 3-way choice here — an idea just stays
unprocessed until someone acts on it.
