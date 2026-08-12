"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://drstone.daemet.com";

// Mirrors LOCALES in build.js (dir + code only — this script doesn't need
// the copy/SEO fields build.js carries).
const LOCALE_DIRS = [
  { code: "zh", dir: "" },
  { code: "en", dir: "en" },
  { code: "zh-cn", dir: "zh-cn" },
  { code: "vi", dir: "vi" },
  { code: "id", dir: "id" },
];

function functionUrl(name) {
  const base = process.env.SUPABASE_URL;
  if (!base) {
    throw new Error("SUPABASE_URL is not set (expected in .env.local)");
  }
  return `${base.replace(/\/$/, "")}/functions/v1/${name}`;
}

async function callAdminFunction(name, payload) {
  const adminSecret = process.env.ADMIN_SECRET;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!adminSecret) {
    throw new Error("ADMIN_SECRET is not set (expected in .env.local)");
  }
  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY is not set (expected in .env.local)");
  }

  const res = await fetch(functionUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-admin-secret": adminSecret,
    },
    body: JSON.stringify(payload ?? {}),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
}

// Finds, for a given article slug, every locale that has a published copy —
// same directory-name-as-slug convention build.js relies on. Returns
// { [localeCode]: absoluteUrl }. Locales with no matching directory are
// simply omitted (not an error — not every article ships in every locale
// immediately).
function findAvailableLocales(slug) {
  const available = {};
  for (const locale of LOCALE_DIRS) {
    const dirPath = locale.dir ? path.join(ROOT, locale.dir, slug) : path.join(ROOT, slug);
    const indexPath = path.join(dirPath, "index.html");
    if (!fs.existsSync(indexPath)) continue;
    const urlPrefix = locale.dir ? `${SITE_URL}/${locale.dir}/${slug}/` : `${SITE_URL}/${slug}/`;
    available[locale.code] = urlPrefix;
  }
  return available;
}

function readArticleMeta(slug, localeCode) {
  const locale = LOCALE_DIRS.find((l) => l.code === localeCode) || LOCALE_DIRS[0];
  const dirPath = locale.dir ? path.join(ROOT, locale.dir, slug) : path.join(ROOT, slug);
  const indexPath = path.join(dirPath, "index.html");
  if (!fs.existsSync(indexPath)) return null;
  const html = fs.readFileSync(indexPath, "utf8");
  const read = (name) => {
    const m = html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content="([^"]*)"\\s*/?>`, "i"));
    return m ? m[1] : "";
  };
  return {
    title: read("article:title") || slug,
    excerpt: read("article:excerpt") || "",
  };
}

module.exports = { callAdminFunction, findAvailableLocales, readArticleMeta, LOCALE_DIRS };
