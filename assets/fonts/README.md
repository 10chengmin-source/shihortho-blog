# Self-hosted Noto Serif TC subset

`NotoSerifTC-Medium-subset.woff2` (weight 500) and
`NotoSerifTC-SemiBold-subset.woff2` (weight 600) back the site's
`--font-serif` token (headings, the site name, section titles). Only
Traditional Chinese pages actually use this font — `zh-cn`, `en`, `vi`, and
`id` fall back to the browser/OS's own serif per `html[lang]` (see the
`@font-face` block in `assets/css/style.css`), so this subset does not need
Simplified Chinese coverage.

## License

SIL Open Font License 1.1 — see `NotoSerifTC-OFL.txt` in this folder
(fetched from Google Fonts' own OFL.txt for this family). Noto Serif TC is
© Google Inc.; subsetting doesn't change the license or require attribution
beyond keeping this file.

## Where the source files came from

Google's official Noto CJK release, Traditional-Chinese-only "Subset OTF"
package (already narrowed from the pan-CJK superfont to just the TC
glyphs, but still the full ~15k-glyph TC character set):

https://github.com/notofonts/noto-cjk/releases/tag/Serif2.003
→ `15_NotoSerifTC.zip` → `SubsetOTF/TC/NotoSerifTC-Medium.otf` /
`NotoSerifTC-SemiBold.otf`

## How the web subset was built

Cut down further to ~6,100 glyphs with `fontTools.subset`, covering:

1. Big5 Level 1 (the standard ~5,500-character "commonly used Traditional
   Chinese" set — derived from Python's built-in `big5` codec, not a
   scraped word list, so it isn't tied to today's copy and should cover
   the vast majority of future headings without a re-subset).
2. Full printable ASCII (Latin letters, digits, punctuation — headings mix
   in English terms like "ROSA" or "IntechOpen").
3. The full Vietnamese diacritic Latin alphabet (generated from Unicode
   NFC combinations, not scraped — future `vi` headings need this even if
   today's don't use every combination).
4. Common CJK/fullwidth punctuation (｜，。「」：？— etc.).
5. Every character actually appearing in an `h1`/`h2`/`h3`/`.logo`/
   `.brand`/`.section-title`/`.section-eyebrow`/card-title element across
   the site today, as a safety net for anything 1–4 missed (e.g. less
   common medical terms).

```
python -m fontTools.subset NotoSerifTC-Medium.otf \
  --text-file=subset-chars.txt --flavor=woff2 --layout-features='*' \
  --output-file=NotoSerifTC-Medium-subset.woff2
```

(same for SemiBold). Needs `pip install fonttools brotli`.

## Regenerating the subset

If a future heading needs a character outside this set, the browser falls
back to the next font in the `--font-serif` stack rather than breaking —
but to add it properly, rebuild `subset-chars.txt` per the recipe above
(steps 1–4 are static; only step 5's scrape needs re-running against the
current site) and re-run the two `fontTools.subset` commands.
