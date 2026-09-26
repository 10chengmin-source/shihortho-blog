# English design system (en/ locale only)

`/en/` has its own visual design, separate from zh/zh-cn/vi/id: white
background, dark-navy/blue accent, system-ui sans-serif everywhere (no
Georgia, no CJK font), name-as-headline hero/about pages, and a reading-rail
sidebar on articles. It shares every template, script and BUILD-marker
mechanism with the other locales — nothing about the content pipeline
forked — it is purely a CSS reskin plus a handful of English-only markup
additions. Never touch zh/zh-cn/vi/id's design while working on English.

## How it works

- **`assets/css/english.css`** is the only file that carries the visual
  design. It is linked only from `en/**/*.html` (right after
  `style.css`), and every rule inside it is scoped under `html[lang="en"]`
  so it cannot leak onto another locale even if a class name collides.
  Almost the entire reskin works by overriding the same `--color-*`,
  `--font-serif`/`--font-mono`/`--font-sans`, `--radius` and `--wide-max`
  custom properties every shared component already reads — so most of
  style.css's components (`.feature-story`, `.team-grid`,
  `.education-grid`, `.faq-block`, `.related-articles`, `.subscribe-block`,
  media-page.css's `.media-*` classes, etc.) reskin for free with zero
  markup changes. Only add a hard-coded color/font value to english.css if
  overriding a token genuinely can't reach it.
- **CSS comments in this file must never contain a literal `*/` inside the
  prose** (e.g. writing "color-*/font-*" as shorthand) — that string
  prematurely closes the comment and silently corrupts everything parsed
  after it until the next real `*/`, with no error in the browser console.
  This exact bug shipped once during the 2026-09 redesign (the entire
  design-token block silently failed to parse) — always write out words
  like "and" instead of using `*/` as a separator inside a comment.
- Nav never collapses into a hamburger on English pages: the
  `<button class="nav-toggle">` element is simply omitted from `en/`
  page markup (it's still present on every other locale), so
  `assets/js/mobile-nav.js` no-ops there (it early-returns when the toggle
  is missing) and english.css just keeps `.site-nav` visible and wrapping
  at every width instead.
- The doctor's name ("Cheng-Min Shih") must stay on one line, with "MD,
  PhD" attached, at any width including 320px — done with
  `container-type: inline-size` on the hero/profile wrapper and a
  `clamp(1.7rem, 8.5cqi, 3.4rem)` font-size on the heading, plus
  `.full-name { white-space: nowrap }`. This makes the name immune to
  reading-level font scaling, since it never reads `--reader-font-size`.
  If you ever see it wrap or overflow, check the CSS file actually parsed
  first (see the `*/` bug above) before assuming the sizing math is wrong.
- English articles are wrapped in `.article-layout > .article-rail +
  article.post` (a small reading-rail sidebar, hidden below 1050px) —
  the other locales' articles are not.
- English shows relative dates as "Latest" / "Within the last 2 weeks" /
  "Within the last month" / "N months ago", computed against the single
  most-recently-published English article (`EN_LATEST_DATE` in
  `scripts/build.js`, recomputed on every build). Other locales keep their
  own "Published N days/weeks/months ago" wording — the two are separate
  code paths (`formatEnRelativeLabel` vs `formatRelativeDate`) and must
  stay that way. The per-article date is a
  `<time class="post-date" datetime="…" data-published="…"
  data-latest="…">` (not a plain `<span>` like other locales); homepage
  cards wrap their date the same way. `assets/js/relative-dates.js`
  (English pages only) refreshes these client-side on load so the label
  stays correct between builds; its thresholds must stay in sync with
  `formatEnRelativeLabel` in `scripts/build.js` if either changes.
- English articles show an estimated read time (`estimateReadTime()` in
  `scripts/build.js`, ~200 wpm over the article's own `.post-content`
  text), recomputed on every build from a `<span class="post-read-time">`
  marker — never hand-write this number, the build always overwrites it.

## Adding or editing an English article

The homepage's philosophy/education/surgery/announcement sections,
related-articles, category label, FAQ, sitemap, RSS, hreflang and canonical
tags are all regenerated automatically from the article's own `<meta
name="article:*">` tags on every `npm run build` — exactly like every other
locale, no separate English article list to maintain. What you must include
by hand when creating a new `en/<slug>/index.html`:

1. Copy the chrome (head boilerplate, `<link>` to `english.css` right after
   `style.css`, header/nav *without* a `.nav-toggle` button, footer) from
   the most recently published English article rather than an older one,
   in case the design has moved on.
2. Wrap the `<article class="post">` in
   `<div class="article-layout"><aside class="article-rail">…</aside>
   <article class="post">…</article></div>` — see any existing English
   article for the rail's exact contents (eyebrow, category, author link,
   "All notes" link). `<span class="article-rail-category">` takes the
   same text as `.post-category` and both update together on every build.
3. Give the post-date a `<time class="post-date" datetime="YYYY-MM-DD"
   data-published="YYYY-MM-DD" data-latest="YYYY-MM-DD">Latest</time>` (the
   `data-latest` value and the label text are both overwritten on the next
   build, so the initial value barely matters) and add
   `<span class="post-read-time">Approx. N min read</span>` right after it
   (also build-recomputed).
4. Add `<script src="/assets/js/relative-dates.js" defer></script>` next to
   the other end-of-body scripts.
5. Only publish the English version once translation and the existing
   medical-content review have both cleared it (same rule as every other
   locale — see the article-notification workflow below); if English isn't
   ready yet, say so and don't publish a placeholder or Chinese text under
   an English URL.

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
