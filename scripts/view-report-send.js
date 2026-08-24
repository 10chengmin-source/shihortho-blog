"use strict";

const { readArticleMeta } = require("./notifications-lib");

const SITE_URL = "https://drstone.daemet.com";
const FROM_EMAIL = "Behind the Strength <notify@stonecare.daemet.com>";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function callRpc(supabaseUrl, anonKey, name) {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${name} failed: ${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildEmailHtml(rows, todayLabel) {
  const totalDelta = rows.reduce((sum, r) => sum + r.delta, 0);
  const totalViews = rows.reduce((sum, r) => sum + r.total_views, 0);
  const anyFirstRun = rows.some((r) => !r.had_prior_snapshot);

  const rowsHtml = rows
    .slice()
    .sort((a, b) => b.delta - a.delta)
    .map((r) => {
      const meta = readArticleMeta(r.slug, "zh");
      const title = meta ? meta.title : r.slug;
      const url = `${SITE_URL}/${r.slug}/`;
      const deltaText = r.had_prior_snapshot ? `+${r.delta}` : "—";
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;"><a href="${url}" style="color:#1a1a1a;text-decoration:none;">${escapeHtml(title)}</a></td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${deltaText}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#888;">${r.total_views}</td>
      </tr>`;
    })
    .join("\n");

  const noteHtml = anyFirstRun
    ? `<p style="color:#888;font-size:13px;">部分文章是第一次記錄快照，「今日新增」暫時顯示為 —，明天開始就會有正確的每日差值。</p>`
    : "";

  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
    <h2 style="font-size:18px;">${todayLabel} 網站瀏覽報表</h2>
    <p>今日全站新增瀏覽 <strong>${totalDelta}</strong> 次，累計總瀏覽 <strong>${totalViews}</strong> 次。</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333;">文章</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #333;">今日新增</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #333;">累計</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    ${noteHtml}
  </div>`;
}

async function sendEmail(apiKey, to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const resendKey = requireEnv("RESEND_API_KEY");
  const recipient = requireEnv("REPORT_RECIPIENT_EMAIL");

  await callRpc(supabaseUrl, anonKey, "record_daily_page_view_snapshot");
  const rows = await callRpc(supabaseUrl, anonKey, "get_page_view_daily_report");

  if (!rows || rows.length === 0) {
    console.log("No page view data yet — skipping send.");
    return;
  }

  const todayLabel = new Date().toISOString().slice(0, 10);
  const html = buildEmailHtml(rows, todayLabel);
  const result = await sendEmail(resendKey, recipient, `背後的力量｜${todayLabel} 瀏覽報表`, html);
  console.log("Sent:", result.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
