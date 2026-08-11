// Admin endpoints (list-pending, set-notification-decision, preview-notification,
// send-notification) are never reachable from the browser — the site's own
// anon key does NOT grant access to these. They're driven only by the local
// Node scripts under scripts/notifications-*.js, which read ADMIN_SECRET
// from a gitignored .env.local and send it as this header. There is no admin
// web UI; the user is the sole operator, working through Claude Code.
export function isAuthorizedAdmin(req: Request): boolean {
  const expected = Deno.env.get("ADMIN_SECRET");
  if (!expected) return false;
  const provided = req.headers.get("x-admin-secret");
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
