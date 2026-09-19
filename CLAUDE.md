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

# Facebook post text (manual, no API)

Automating posts to the "背後的力量" Facebook Page via the Graph API was
attempted and abandoned: Meta requires Business Verification (submitting
official documents and passing manual review) to unlock the
`pages_manage_posts` permission, which is more overhead than the user wants
right now. The Meta developer app and Business Portfolio created during
that attempt still exist but nothing is wired to them — do not try to
resume that automation path unless the user explicitly asks to revisit it.

Instead, whenever a new article is published, draft a ready-to-copy
Facebook post as part of the same conversation where the email-notification
question is asked (see "The three-way publish decision" above) — this is a
separate question from that one, not a replacement for it. Ask the user
whether they also want a Facebook post drafted for this article. If yes,
write a short zh (Traditional Chinese) post: a 1–3 sentence hook plus the
canonical article URL, matching the site's plain, non-promotional,
fact-grounded tone (same voice as the article excerpts and the About page
philosophy section) — no marketing language, no superlatives. Present it in
a fenced code block so the user can copy-paste it directly into Facebook
themselves. Do not attempt to post it via any tool or browser automation.

# Mobile article-idea capture

A private, unlisted page at a random 128-bit path (not linked from any
nav, `noindex`, moved off a guessable name like `/notes/` on purpose —
that old path is intentionally dead, not redirected, so it can't leak the
real one) is where the user jots raw article ideas from their phone,
typed or via the phone keyboard's own dictation button. Submissions land
in the `article_ideas` Supabase table via the `submit-idea` Edge
Function. Never link to this page from anywhere public.

A `SessionStart` hook (`scripts/ideas-session-hook.js`) surfaces any
unprocessed idea automatically at the start of a session, the same way
pending notifications do. When one shows up: discuss it with the user,
help turn it into an article if they want to, and once it's been used (or
they say to drop it) mark it with `scripts/ideas-mark-processed.js <id>` so
it stops resurfacing. `npm run ideas:pending` checks manually. Unlike
notification decisions, there's no 3-way choice here — an idea just stays
unprocessed until someone acts on it.

# AI-writing audit (permanent copy rule)

This is a medical site under a real physician's name. Every piece of public
copy must read like a person wrote it: direct, concrete, no template. These
rules apply to every new or edited page, article, FAQ, button, CTA, banner,
SEO description, image caption, and social/FB draft, in every locale
(zh / en / zh-cn / vi / id). Never publish, commit, or hand over copy that has
not been through this audit.

## Before any copy change is committed

1. Run `node scripts/copy-audit.js scan` (whole site) or
   `node scripts/copy-audit.js file <draft>` (a draft). It only lists
   *candidates*; the real check is reading the text. Do not rely on literal
   matching: a reworded or reordered version of the same "build a contrast,
   then lift to a moral" template counts.
2. Check: banned patterns below; near-equivalent contrast templates;
   abstract uplift with no content behind it; several consecutive sentences
   with the same tidy rhythm; ChatGPT/Claude-style cadence; whether a
   plainer, more concrete sentence works; whether the rewrite changed a
   medical fact.
3. Fix first, then commit.

## Banned Chinese patterns (and close variants)

這不是……而是…… / 從來不只是…… / 不只是……更是…… / 真正重要的不是…… /
重點不在……而在…… / 與其說是……不如說是…… / 看似……其實…… /
表面上……背後其實…… / 你以為……其實…… / 很多人以為……但真正…… /
問題從來不是…… / 答案從來不在…… / 真正的關鍵在於…… / 真正值得思考的是…… /
真正需要被看見的是…… / 真正改變的是…… / 重要的從來都不是…… /
我們需要的不只是…… / 所謂的……其實是…… / 說到底…… / 到最後你會發現…… /
也許我們該重新思考…… / 這背後反映的是…… / 這件事提醒我們…… /
更深一層來看…… / 如果只看到……就太可惜了 / 別急著…… / 先別急著下結論 /
值得注意的是…… / 值得一提的是…… / 不能忽略的是…… / 更值得關注的是…… /
某種程度上…… / 換個角度看…… / 我們常常忽略…… / 很多時候…… /
有時候真正需要的…… / 不是因為……而是因為…… / 不是所有……都…… /
不是每一個……都…… / 這也正是為什麼…… / 這正是……的原因 /
這背後，其實有一個很簡單的道理 / 乍看之下…… / 當你開始理解…… /
你會發現…… / 這件事比想像中更複雜 / 事情沒有那麼簡單 / 故事要從……說起

Also avoid abstract uplift lines with no content behind them, e.g. 我們談的其實是選擇 /
最後回到人的本質 / 科技的盡頭仍然是人 / 醫療的核心始終是信任.

## Banned English patterns (and close variants)

It's not about X. It's about Y. / This isn't just X. It's Y. / It's more than
just X. / The real question is… / The real challenge is… / What really matters
is… / At its core… / At the end of the day… / The key takeaway is… / The
bottom line is… / Here's the thing… / Let that sink in. / Think about that. /
You might think X, but… / On the surface…, but… / It may seem like X, but… /
The truth is… / Here's the truth… / The reality is… / What most people miss
is… / What no one tells you is… / The part nobody talks about is… / This
changes everything. / That's where the magic happens. / That's the game
changer. / This is where things get interesting. / And that's exactly why… /
This is precisely why… / The deeper issue is… / If you look closely… / Step
back for a moment… / Let's unpack this. / Let's break it down. / Let's dive
in. / Here's why. / Here's what you need to know. / The answer may surprise
you. / It's simpler than you think. / It's more complicated than it looks. /
In today's fast-changing world… / In an era of… / Now more than ever… / As we
navigate… / The future is not X. It is Y. / The future belongs to… / This is
not the end. It's the beginning. / Because ultimately… / Ultimately, it comes
down to… / When all is said and done… / The lesson here is simple… / The
message is clear… / One thing is clear…

Do not stack abstract corporate words: journey, transformation, meaningful,
powerful, redefine, reimagine, unlock, elevate, empower, reshape,
game-changing, groundbreaking, seamless, innovative, holistic, impactful.
They are not banned outright, but delete or rewrite them when no concrete
fact backs them up.

## How to rewrite

Go straight to the content. Prefer concrete people, situations, problems,
treatments, steps, and results. Few abstract value judgments. No manufactured
drama, no needless contrast, no slogan-style punchline pretending to be deep.
Keep a natural human rhythm. Chinese should be natural and concise, not
translated-sounding; English should read like a physician or medical
institution wrote it, not a LinkedIn motivational post. Do not add typos,
filler words, or unprofessional phrasing just to sound less like AI.

## Medical content

- Never add medical facts, efficacy, success rates, risk figures, recovery
  times, or comparisons that are not in the source.
- Never make a cautious medical statement more certain, add unsourced study
  conclusions, or exaggerate surgical outcomes.
- If a sentence has both a copy problem and a medical-fact problem, change
  only the language; leave the medical claim and flag it for the doctor.
- If unsure whether something is medical content, keep the original wording
  and flag it.

## Exceptions

If a banned pattern seems genuinely the best wording somewhere, do not use it.
Tell the user which pattern, on which page, why, and why a direct wording is
worse, and wait for explicit approval. Without approval, always use another
wording.

## Process preference for bulk copy changes

For a site-wide copy sweep, first list every proposed change (file, original,
issue type, suggested text) for the user to tick. Apply only what they select,
and keep zh / zh-cn / en / vi / id consistent. Text the user wrote or
approved verbatim is flagged, not silently rewritten. Never touch the private
`idea-capture-*` page.
