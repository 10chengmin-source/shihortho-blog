// Table-based, single-column, inline-CSS-only HTML for maximum compatibility
// across Gmail, Apple Mail, Outlook, and mobile clients. No <style> block, no
// JS, no web fonts, one primary CTA button. Deliberately plain to match the
// site's fact-grounded, non-promotional tone — this is a notification, not a
// marketing email.

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapper(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;border:1px solid #e2e2e2;">
            <tr>
              <td style="padding:36px 32px;">
${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:999px;background-color:#066b4a;">
                      <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(
                        label
                      )}</a>
                    </td>
                  </tr>
                </table>`;
}

export function renderConfirmEmail(opts: {
  siteName: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  ignoreNote: string;
}): string {
  const body = `
                <p style="margin:0 0 4px;font-size:13px;color:#8a8a8a;">${escapeHtml(
                  opts.siteName
                )}</p>
                <h1 style="margin:0 0 16px;font-size:20px;color:#14181c;">${escapeHtml(
                  opts.heading
                )}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#3a3a3a;">${escapeHtml(
                  opts.body
                )}</p>
                ${ctaButton(opts.ctaUrl, opts.ctaLabel)}
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9a9a9a;">${escapeHtml(
                  opts.ignoreNote
                )}</p>`;
  return wrapper(body);
}

export function renderNotificationEmail(opts: {
  siteName: string;
  eyebrow: string;
  title: string;
  excerpt?: string;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeLabel: string;
  unsubscribeUrl: string;
}): string {
  const excerptHtml = opts.excerpt
    ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#3a3a3a;">${escapeHtml(
        opts.excerpt
      )}</p>`
    : "";
  const body = `
                <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#066b4a;font-weight:600;">${escapeHtml(
                  opts.eyebrow
                )}</p>
                <h1 style="margin:0;font-size:20px;line-height:1.4;color:#14181c;">${escapeHtml(
                  opts.title
                )}</h1>
                ${excerptHtml}
                ${ctaButton(opts.ctaUrl, opts.ctaLabel)}
                <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #eeeeee;font-size:13px;color:#9a9a9a;">${escapeHtml(
                  opts.siteName
                )} · <a href="${opts.unsubscribeUrl}" style="color:#9a9a9a;">${escapeHtml(
    opts.unsubscribeLabel
  )}</a></p>`;
  return wrapper(body);
}
