#!/usr/bin/env node
// Candidate finder for the AI-writing audit in CLAUDE.md. It only surfaces
// suspects; deciding whether a sentence is really a template stays manual.
//
//   node scripts/copy-audit.js scan            # flag candidates in all public copy
//   node scripts/copy-audit.js dump <locale>   # write readable text of every page to stdout
//   node scripts/copy-audit.js file <path>     # scan one text file (e.g. a draft .md)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LOCALE_DIRS = ["en", "zh-cn", "vi", "id"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".claude"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith("idea-capture-")) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".html")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function localeOf(file) {
  const first = path.relative(ROOT, file).split(path.sep)[0];
  return LOCALE_DIRS.includes(first) ? first : "zh";
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function extractUnits(html) {
  const units = [];
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (title) units.push({ kind: "title", text: decode(title[1]).trim() });

  for (const m of html.matchAll(/<meta\s+([^>]*?)\/?>/gi)) {
    const a = attrs(m[1]);
    const key = a.name || a.property;
    if (a.content && /^(description|og:description|og:title|twitter:description|article:title|article:excerpt)$/.test(key)) {
      units.push({ kind: `meta ${key}`, text: decode(a.content).trim() });
    }
  }

  const bodyStart = html.search(/<body[\s>]/i);
  let body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  for (const m of body.matchAll(/<(\w+)\s+([^>]*)>/g)) {
    const a = attrs(m[2]);
    for (const k of ["alt", "aria-label", "title", "data-label", "data-copied-label", "placeholder"]) {
      if (a[k] && a[k].trim()) units.push({ kind: `attr ${k}`, text: decode(a[k]).trim() });
    }
  }

  const BREAK = "@@BREAK@@";
  const text = body
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|details|summary|blockquote|figcaption|td|th|header|footer|nav|main|ul|ol|table|label)>/gi, BREAK)
    .replace(/<[^>]+>/g, "");
  for (const line of decode(text).split(BREAK)) {
    const t = line.replace(/\s+/g, " ").trim();
    if (t) units.push({ kind: "text", text: t });
  }
  return units;
}

const ZH = [
  ["這不是…而是", /這不是[^。！？\n]{0,40}(而是|，是)/],
  ["不是…而是(反差)", /(並?不是|並非|不在於)[^。！？；\n]{1,40}[，,、]\s*(而)?(是|在於)/],
  ["而不是(反差)", /而不是/],
  ["從來不只是", /從來(都)?不只是/],
  ["不只是…更是", /不只(是)?[^。！？\n]{0,30}(更是|也是|而是)/],
  ["真正…", /真正(重要|關鍵|的關鍵|值得|需要被看見|改變|的重點|在於)/],
  ["重點不在", /重點不在/],
  ["與其說", /與其說/],
  ["看似…其實", /看似[^。！？\n]{0,30}(其實|實則|卻)/],
  ["表面上…", /表面上/],
  ["你以為/很多人以為", /(你以為|很多人以為|大家以為|常以為)/],
  ["從來不是/從來不在", /(問題|答案|重要的|關鍵)?從來(都)?(不是|不在|沒有)/],
  ["關鍵在於", /(關鍵|重點|核心)在於/],
  ["說到底/最後你會發現", /(說到底|到最後你會發現|歸根結底|歸根究柢)/],
  ["重新思考/背後反映/提醒我們", /(重新思考|背後反映|這件事提醒我們|更深一層|就太可惜)/],
  ["別急著", /(別急著|先別急著|不要急著)/],
  ["值得注意/值得一提", /(值得注意的是|值得一提的是|不能忽略的是|更值得關注的是)/],
  ["某種程度上/換個角度", /(某種程度上|換個角度)/],
  ["常常忽略/很多時候/有時候真正", /(我們常常忽略|很多時候|有時候真正)/],
  ["不是因為…而是因為", /不是因為[^。！？\n]{0,40}而是因為/],
  ["不是所有/不是每一個", /不是(所有|每一個|每個)/],
  ["這也正是為什麼/這正是", /(這也正是為什麼|這正是)/],
  ["這背後其實", /這背後[，,]?\s*其實/],
  ["乍看之下/當你開始理解/你會發現", /(乍看之下|當你開始理解|你會發現|您會發現)/],
  ["比想像中更複雜/沒那麼簡單", /(比想像中更複雜|沒有那麼簡單|事情沒有那麼)/],
  ["故事要從…說起", /故事要從/],
  ["抽象拔高", /(我們談的其實|回到人的本質|科技的盡頭|核心始終是|始終是信任)/],
  ["所謂的…其實", /所謂的[^。！？\n]{0,20}其實/],
  ["更重要的是/固然", /(更重要的是|固然[^。]{0,30}但更)/],
  ["需要強調的是/常被忽略", /(需要強調的是|常被忽略|容易被忽略)/],
  ["這也是為什麼", /這也是為什麼/],
  ["無縫(corporate)", /無縫/],
  ["並不代表/並非(watch)", /(並不代表|並非)/],
  ["真正(watch)", /真正/],
  ["其實(watch)", /其實/],
  ["不只…還/也(watch)", /不只[^。！？\n]{1,20}[，,]?\s*(還|更|也)/],
];

const EN = [
  ["It's not about X", /\bit[’']?s not (just )?about\b/i],
  ["This isn't just X", /\bthis isn[’']?t just\b/i],
  ["more than just", /\b(it[’']?s )?more than (just|simply)\b/i],
  ["The real question/challenge", /\bthe real (question|challenge|issue|problem)\b/i],
  ["What really matters", /\bwhat (really|truly) matters\b/i],
  ["At its core", /\bat (its|the) core\b/i],
  ["At the end of the day", /\bat the end of the day\b/i],
  ["key takeaway/bottom line", /\b(the key takeaway|the bottom line)\b/i],
  ["Here's the thing/truth", /\bhere[’']?s (the thing|the truth|why|what you need to know)\b/i],
  ["Let that sink in", /\b(let that sink in|think about that)\b/i],
  ["You might think", /\byou (might|may) think\b/i],
  ["On the surface / seem like", /\b(on the surface|it may seem like|it might seem like)\b/i],
  ["The truth/reality is", /\bthe (truth|reality) is\b/i],
  ["What most people miss", /\b(what most people miss|what no one tells you|nobody talks about)\b/i],
  ["changes everything / game changer", /\b(this changes everything|game[- ]?chang(er|ing)|where the magic happens)\b/i],
  ["where things get interesting", /\bwhere things get interesting\b/i],
  ["That's exactly why / precisely why", /\b(that[’']?s exactly why|this is precisely why|and that[’']?s why)\b/i],
  ["deeper issue / look closely", /\b(the deeper issue|if you look closely|step back for a moment)\b/i],
  ["Let's unpack/dive", /\blet[’']?s (unpack|break it down|dive in)\b/i],
  ["may surprise you / simpler than", /\b(may surprise you|simpler than you think|more complicated than it looks)\b/i],
  ["In today's / era of / now more than ever", /\b(in today[’']?s|in an era of|now more than ever|as we navigate)\b/i],
  ["future is not / belongs", /\bthe future (is not|belongs)\b/i],
  ["Ultimately / when all is said", /\b(because ultimately|ultimately, it comes down|when all is said and done)\b/i],
  ["lesson/message is clear", /\b(the lesson here|the message is clear|one thing is clear)\b/i],
  ["is not X, it is Y", /\b(is|are) not (just |simply |merely |only )?[^.;]{1,60}[;,.—-]\s*(it|they|but) (is|are)\b/i],
  ["not only…but also (watch)", /\bnot only\b[^.]{0,80}\bbut (also|as well)\b/i],
  ["not just (watch)", /\bnot just\b/i],
  ["isn't just / doesn't just", /\b(is|was|are|were|does|do|did)(n[’']?t| not) (just|simply|merely|only)\b/i],
  ["Rather, (contrast)", /[.;]\s+Rather,/],
  ["not because…but because", /\bnot because\b[^.]{1,80}\bbut because\b/i],
  ["isn't X. It's Y", /\b(isn[’']?t|wasn[’']?t|is not|was not|has never been|never been)\b[^.]{1,90}[.:;]\s+(it|that)[’']?s\b/i],
  ["what truly/actually drives", /\bwhat (truly|actually|really) (drives|determines|matters)\b/i],
  ["often overlooked", /\b(often|easily) overlooked\b/i],
  ["corporate words", /\b(journey|transformation|meaningful|powerful|redefin\w*|reimagin\w*|unlock\w*|elevat\w*|empower\w*|reshap\w*|groundbreaking|seamless\w*|innovative|holistic|impactful)\b/i],
];

const OTHER = [
  ["vi: không phải…mà là", /không phải[^.]{1,60}mà là/i],
  ["vi: không chỉ…mà còn (watch)", /không chỉ[^.]{1,60}mà còn/i],
  ["vi: thực ra/thật ra (watch)", /\b(thực ra|thật ra|thực chất)\b/i],
  ["id: bukan…melainkan/tetapi", /bukan[^.]{1,60}(melainkan|tetapi|tapi)/i],
  ["id: sebenarnya (watch)", /\bsebenarnya\b/i],
  ["id: tidak hanya…tetapi juga (watch)", /tidak (hanya|sekadar)[^.]{1,60}(tetapi|melainkan)/i],
];

function patternsFor(locale) {
  if (locale === "zh" || locale === "zh-cn") return ZH;
  if (locale === "en") return EN;
  return OTHER;
}

function scanText(text, patterns) {
  const hits = [];
  for (const [name, re] of patterns) {
    const m = text.match(re);
    if (m) hits.push({ name, at: m.index, match: m[0] });
  }
  return hits;
}

function snippet(text, at, len) {
  const start = Math.max(0, at - 30);
  return (start > 0 ? "…" : "") + text.slice(start, at + len + 50) + (at + len + 50 < text.length ? "…" : "");
}

function scanFiles() {
  const seen = new Map();
  const add = (locale, where, text) => {
    for (const h of scanText(text, patternsFor(locale))) {
      const key = `${locale}|${h.name}|${text}`;
      if (!seen.has(key)) seen.set(key, { locale, name: h.name, text, at: h.at, len: h.match.length, where: [] });
      seen.get(key).where.push(where);
    }
  };

  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    for (const u of extractUnits(fs.readFileSync(file, "utf8"))) add(localeOf(file), `${rel} [${u.kind}]`, u.text);
  }

  const sourceFiles = [
    "scripts/build.js",
    "assets/js/subscribe.js",
    "assets/js/share.js",
    "assets/js/subscribe-action.js",
    "supabase/functions/_shared/email-template.ts",
    "supabase/functions/_shared/locales.ts",
  ];
  for (const rel of sourceFiles) {
    const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const locale of ["zh", "en", "vi"]) {
        if (locale === "vi" && !/[ăâđêôơưàáảãạ]/i.test(line)) continue;
        if (locale === "zh" && !/[一-鿿]/.test(line)) continue;
        if (locale === "en" && /[一-鿿]/.test(line)) continue;
        add(locale === "vi" ? "vi" : locale, `${rel}:${i + 1}`, line.trim());
      }
    });
  }

  const rows = [...seen.values()].sort((a, b) => a.locale.localeCompare(b.locale) || a.name.localeCompare(b.name));
  for (const r of rows) {
    console.log(`[${r.locale}] ${r.name}  (${r.where.length}x)  ${r.where[0]}`);
    console.log(`    ${snippet(r.text, r.at, r.len)}`);
  }
  console.log(`\n${rows.length} distinct candidate(s)`);
}

function scanSingle(file) {
  const raw = fs.readFileSync(path.resolve(file), "utf8");
  const locale = /[一-鿿]/.test(raw) ? "zh" : "en";
  let n = 0;
  raw.split(/\r?\n/).forEach((line, i) => {
    for (const h of scanText(line, patternsFor(locale))) {
      n++;
      console.log(`${file}:${i + 1} ${h.name}\n    ${snippet(line, h.at, h.match.length)}`);
    }
  });
  console.log(`\n${n} candidate(s)`);
}

function dump(locale) {
  for (const file of walk(ROOT).sort()) {
    if (localeOf(file) !== locale) continue;
    console.log(`\n===== ${path.relative(ROOT, file).split(path.sep).join("/")} =====`);
    for (const u of extractUnits(fs.readFileSync(file, "utf8"))) console.log(`[${u.kind}] ${u.text}`);
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "scan") scanFiles();
else if (cmd === "dump" && arg) dump(arg);
else if (cmd === "file" && arg) scanSingle(arg);
else {
  console.error("usage: copy-audit.js scan | dump <zh|en|zh-cn|vi|id> | file <path>");
  process.exit(1);
}
