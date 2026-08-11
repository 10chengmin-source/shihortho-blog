// RESEND_API_KEY is set via `supabase secrets set`, never committed, never
// exposed to the browser. FROM_EMAIL must be on a domain verified in Resend
// (stonecare.daemet.com) or sends will fail.
const FROM_EMAIL = "Behind the Strength <notify@stonecare.daemet.com>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${text}` };
  }

  const data = await res.json();
  return { ok: true, id: data.id };
}
