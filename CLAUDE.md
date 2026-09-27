# English/Vietnamese/Indonesian design system (en/vi/id)

`/en/`, `/vi/` and `/id/` share one visual design, separate from zh/zh-cn:
white background, dark-navy/blue accent, system-ui sans-serif, name-as-headline
hero/about pages, and a reading-rail sidebar on articles. vi/id were brought
onto this design in a 2026-09 follow-up ("越南跟印尼文採取跟英文版一樣的色調跟排版") —
before that, only English had it and vi/id kept the dark-green look. It
shares every template, script and BUILD-marker mechanism with zh/zh-cn —
nothing about the content pipeline forked — it is purely a CSS reskin plus a
handful of markup additions (masthead structure, hero/profile-header text,
article-rail wrapper). Never touch zh/zh-cn's *content* or *brand color*
while working on this design system; shared layout primitives (see the
"Shared cross-locale fixes" section below) are fair game and increasingly
common after the 2026-09 multilingual audit.

If you see an older note anywhere claiming this design is "English only" or
that `english.css` is scoped to `html[lang="en"]` alone, it's stale — don't
re-narrow the selectors back down without the user asking.

## How it works

- **`assets/css/english.css`** is the only file that carries this design.
  It is linked from `en/**/*.html`, `vi/**/*.html` and `id/**/*.html` (right
  after `style.css`), and every rule inside it is scoped under
  `:is(html[lang="en"], html[lang="vi"], html[lang="id"])` so it cannot leak
  onto zh/zh-cn even if a class name collides. Almost the entire reskin works
  by overriding the same `--color-*`,
  `--font-serif`/`--font-mono`/`--font-sans`/`--font-brand`, `--radius` and
  `--wide-max` custom properties every shared component already reads — so
  most of style.css's components (`.feature-story`, `.team-grid`,
  `.education-grid`, `.faq-block`, `.related-articles`, `.subscribe-block`,
  media-page.css's `.media-*` classes, etc.) reskin for free with zero
  markup changes. Only add a hard-coded color/font value to english.css if
  overriding a token genuinely can't reach it.
- **CSS comments in this file (and style.css) must never contain a literal
  `*/` inside the prose** (e.g. writing "color-*/font-*" as shorthand) —
  that string prematurely closes the comment and silently corrupts
  everything parsed after it until the next real `*/`, with no error in the
  browser console. This exact bug shipped once during the 2026-09 redesign
  (the entire design-token block silently failed to parse) — always write
  out words like "and" instead of using `*/` as a separator inside a
  comment.
- Nav is a compact two-part header on en/vi/id: a masthead row (logo + the
  one essential booking button/switch + a hamburger toggle) and a separate
  `.site-nav` row (the six section links, LINE, language, share) that's
  always its own row via `flex-basis: 100%` and collapses behind the
  hamburger below 860px. This replaced an earlier "no hamburger, nav always
  wraps inline" version that turned out to make the collapsed mobile header
  too tall (2026-09 multilingual audit) — if you see a claim anywhere that
  English has no hamburger, it's stale; don't restore that behavior.
  `assets/js/mobile-nav.js` picks this fixed-breakpoint behavior
  *structurally*: `usesMastheadLayout` is true whenever `.booking-switch`
  is not inside `#site-nav` (true for en/vi/id, false for zh/zh-cn, whose
  booking-switch still lives inside the collapsible nav and uses the
  separate fits-on-one-line measurement path). Don't gate this on
  `document.documentElement.lang` again — that's what caused vi/id's
  masthead to break the first time they got this markup (the booking
  button collapsed into a single narrow vertical column at 320px because
  the old lang-gated JS branch, and a `.site-header .container` grid rule
  in style.css written for the old zh/zh-cn-only structure, both still
  matched vi/id after their markup changed but their behavior didn't).
  `style.css`'s "320px header doesn't let the brand name push the toggle
  onto its own row" grid fix is correspondingly scoped to
  `html:not([lang="en"]):not([lang="vi"]):not([lang="id"])` — it's a
  zh/zh-cn-only rule now, not "every non-English locale".
- The doctor's name ("Cheng-Min Shih" / "Bác sĩ Shih Cheng-Min" / "Dr. Shih
  Cheng-Min") must stay on one line, with "MD, PhD" attached where used, at
  any width including 320px — done with `container-type: inline-size` on
  the hero/profile wrapper and a `clamp(1.7rem, 8.5cqi, 3.4rem)` font-size
  on the heading, plus `.full-name { white-space: nowrap }`. This makes the
  name immune to reading-level font scaling, since it never reads
  `--reader-font-size`. If you ever see it wrap or overflow, check the CSS
  file actually parsed first (see the `*/` bug above) before assuming the
  sizing math is wrong.
- en/vi/id articles are wrapped in `.article-layout > .article-rail +
  article.post` (a small reading-rail sidebar, hidden below 1050px) —
  zh/zh-cn's articles are not. vi/id's rail uses locale-appropriate labels
  (eyebrow "Tạp Chí"/"Catatan", author name, role, "all notes" link) but
  deliberately keeps each locale's own relative-date/read-time wording —
  see the next point.
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
   `style.css`, header/nav including the masthead `.nav-toggle` button,
   footer) from the most recently published English article rather than an
   older one, in case the design has moved on.
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

# Shared cross-locale fixes (2026-09 multilingual audit)

An audit of all five locales (see the conversation history / the report at
the time, `SITE_AUDIT_FOR_CLAUDE_CODE.md`) found layout and translation
issues across zh/zh-cn/vi/id, not just English. The user explicitly
authorized touching shared templates/CSS for every locale for this — an
earlier, narrower "English only" restriction from before that audit no
longer applies. What changed, and the rules to keep it that way:

- **Typography is sans-serif site-wide now.** `--font-serif` (which drives
  most headings/titles everywhere) is a real sans stack per locale
  (`"Noto Sans TC"`/`"Noto Sans SC"` + system CJK sans fallbacks for
  zh/zh-cn, `system-ui` for en/vi/id) instead of the old self-hosted Noto
  *Serif* TC / Georgia look. Brand identity is preserved separately: `.logo`
  reads a new `--font-brand` token instead, which still resolves to the
  self-hosted serif on zh (and a serif SC stack on zh-cn) — so the
  "S" mark + wordmark keep their distinct look while every other heading on
  the page is a clean sans face. `--font-mono` (eyebrows/category labels)
  was also retired in favor of `--font-sans` /`system-ui` — it read as
  low-contrast "code" styling, not normal interface text. Never reintroduce
  a bare monospace stack for body-adjacent UI text, and never point
  `--font-serif` back at Georgia for vi/id (poor Vietnamese diacritic
  support was part of why it changed).
- **Mobile hero/About order is title-then-photo everywhere.** Both
  `.hero`'s `.hero-visual` and `.profile-header`'s photo `<div>` used to
  force themselves to the top of the mobile single-column layout via
  `order: -1`/DOM order; removing that (plus a matching order-swap for
  `.profile-header`) means the name/intro appear before the portrait on
  every locale's phone view. English already had its own equivalent fix; it
  now just falls out of the same shared rule.
- **The About page's intro paragraph lives in the profile-header itself**
  (`.profile-intro-text`, right after the name/`.profile-name-en`), not as
  the first paragraph of `.post-content` below it — this is what actually
  keeps the intro visible before the photo on mobile, not just the name. If
  you ever add a new locale's About page, put the "I am Dr. ..." sentence
  there, not back in `.post-content`.
- **en/vi/id About pages now group Current Position/Education and Training
  & Experience the same way**: `.credential-columns` (a 2-up grid, one
  `<section>` per group) for the first, `.training-copy > .training-group`
  (one `<section class="training-group">` with an `<h3 class="training-
  label">` per topic — clinical training & certification / advanced
  training & mentorship / professional memberships & recognition / research
  & innovation) for the second. The `<article class="post">` also needs
  `class="post profile-post"` for the wider shell these need
  (`.post-content`/`.faq-block`/`.article-toc` inside still narrow back down
  to a normal reading width — see style.css). **zh/zh-cn's About page is
  explicitly excluded from this** — their Training & Experience stays one
  long flowing paragraph, since it's protected content (see below); do not
  fragment it into cards no matter how tempting the parallel looks.
- **`.article-toc` (the About page's "On this page" box) is a slim inline
  bar for every locale now**, not a padded card — a page outline shouldn't
  be taller than the heading it sits under. `.post-content h2[id]`,
  `.credential-columns[id]` and `.faq-heading[id]` all got
  `scroll-margin-top` so jumping to one of these anchors doesn't land it
  half-hidden under the sticky header.
- **The 320px mobile header no longer lets a long brand name push the
  hamburger onto its own row — for zh/zh-cn.** `.site-header .container` is
  a `minmax(0,1fr) auto` grid below 640px, scoped to
  `html:not([lang="en"]):not([lang="vi"]):not([lang="id"])`: the logo can
  wrap onto two lines if it has to, but the toggle button always stays on
  the first line next to it. en/vi/id are excluded because they use the
  masthead structure instead (see above) — vi/id were originally included
  in this fix (their brand names run longer than zh's) back when their
  booking-switch still lived inside `.site-nav` like zh/zh-cn's; once vi/id
  moved to the masthead structure in the 2026-09 color/layout match-up,
  this grid rule had to stop matching them too, or it fights the masthead's
  own flex layout (this exact conflict broke vi/id's masthead once — see
  the mobile-nav.js note above).
- **`readMeta()` in `scripts/build.js` now decodes HTML entities** before
  handing a title/excerpt back to the rest of the pipeline. Meta tags
  necessarily store `"` as `&quot;` (required inside a quoted attribute),
  but every caller re-escapes with `escapeHtml()`/`escapeXml()` wherever it
  places the value back into HTML/XML — leaving it pre-escaped meant a
  title containing a quote mark rendered as the literal text `&quot;Foo
  &quot;` on the page (id's `20260802-why-ask-again` was the article that
  surfaced this). If you ever add a second meta-reading helper, decode
  there too — the fix must live at the one point data enters the pipeline,
  not patched at each output site.
- **`_redirects` (repo root, copied into `dist/` by `scripts/prepare-
  dist.js`) explicitly redirects `/zh-cn/booking/`, `/vi/booking/` and
  `/id/booking/` to their locale's homepage.** Those three locales have no
  dedicated booking page (their nav's booking-switch dropdown already
  covers it inline) — without the redirect, Cloudflare Pages' fallback
  silently served the zh homepage at those URLs with a 200 status. Add a
  real page under a locale's `booking/` directory (mirroring `en/booking/`)
  instead of just deleting its `_redirects` line, if that locale ever gets
  its own booking page.
- **Protected content (zh `/` and zh-cn `/zh-cn/`)**: existing body copy,
  headings, excerpts, captions, FAQ and medical claims are never reworded,
  re-punctuated or reordered within a paragraph by any of the above — only
  container/font/spacing/block-position changes apply to them. When
  verifying a change here, diff extracted visible text (tags/attributes
  stripped, whitespace normalized) against the last commit rather than
  comparing raw HTML — the version-hash query strings and BUILD-marker
  regions change on every build regardless of content edits, so a raw diff
  always shows noise.
- **Name order (Cheng-Min Shih vs Shih Cheng-Min)** is intentionally
  different across locales (en: given-name-first; vi/id: family-name-first)
  and is internally consistent within each — this was audited and is a
  deliberate per-locale choice, not a bug to "fix" toward one convention.
  Don't silently change it in either direction without the user asking.

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
